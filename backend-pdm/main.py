import sys
import json
from datetime import datetime


from flask import escape, request, jsonify


import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from firebase_admin import auth

# Google Maps API 
import googlemaps

# Google ORTools
from ortools.constraint_solver import pywrapcp
from ortools.constraint_solver import routing_enums_pb2


# Firebase Setup Use the application default credentials
cred = credentials.ApplicationDefault()
firebase_admin.initialize_app(cred, {
    'projectId': 'studienarbeit',
    })
db = firestore.Client()

# Google Maps Setup
gmaps = googlemaps.Client(key='')


globalErrorMessage = "Request not supported, check documentation"

def auth_request(content):
    user_token = content['user_token']

    decoded_token = auth.verify_id_token(user_token, check_revoked=True)
    uid = decoded_token['uid']
    return uid

def verify_request(request):
    # Set CORS headers for the main request
    headers = {
        'Access-Control-Allow-Origin': '*'
    }
    # Set CORS headers for the preflight request
    if request.method == 'OPTIONS':
        # Allows GET requests from any origin with the Content-Type
        # header and caches preflight response for an 3600s
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return False, 204, '', headers

    elif request.method == 'POST' and request.headers['content-type'] == 'application/json':
        try:
            content = request.get_json()
            uid = auth_request(content)
        except Exception as e:
            return False, 400, 'error parsing, check your request = POST' + str(e), headers
        except auth.AuthError as e:
            return False, 400, "Token Revoked", headers
        except auth.ValueError as e:
            return False, 400, "Invalid Token", headers

        return True, 200, [uid, content], headers
    else:
        return False, 400, 'Not supported. Make sure to POST with application/JSON header', headers


def parcel(request):

    verification, http_code, message, headers = verify_request(request)
    if verification == False:
        return (message, http_code, headers)
    elif verification == True:
        uid = message[0]
        content = message[1]

    req_action = request.get_json()['action']

    if req_action == 'submit' or req_action == 'check':
        try:
            
            size = content['size']
            weight = content['weight']
            # Stored as {"lng": xx, "lat": xx} -> str(lat, long) order important
            pickup_location = content['pickup_location']
            destination_location = content['destination_location']
            priority = content['priority']
            comment = content['comment']

            # get distance through gmaps
            now = datetime.now()
            directions_result = gmaps.directions((pickup_location['lat'], pickup_location['lng']),
                                                (destination_location['lat'], destination_location['lng']),
                                                mode="driving",
                                                avoid='ferries',
                                                departure_time=now)
                

            est_driving_distance = directions_result[0]['legs'][0]['distance']['value']

            price = parcelPriceCalculator(size, weight, est_driving_distance, priority)
            parcel_status = 'home'
            time_created = datetime.now()
            parcel_id = "none"

            if req_action == 'submit':
                
                doc_ref = db.collection(u'parcels').document()
                doc_ref.set({
                    u'customer_id': uid,
                    u'size': size,
                    u'weight': weight,
                    u'pickup_location': pickup_location,
                    u'destination_location': destination_location,
                    u'est_distance': est_driving_distance,
                    u'priority': priority,
                    u'comment': comment,
                    u'time_created': time_created,
                    u'price': price,
                    u'parcel_status': parcel_status
                })
                parcel_id = doc_ref.id

            answ = jsonify(
                action_response = req_action,
                price = price,
                parcel_id = parcel_id,
                parcel_status =  parcel_status,
                time_created = str(time_created)
            )
        
        except Exception as e:
            return ('error in post req - submit/check: ' + str(e), 400, headers)
        else:
            return (answ, 200, headers)

    elif req_action == 'list' or req_action == 'detail':
        try:
            parcel_id = content['parcel_id']

            if parcel_id == '' or req_action == 'list':
                search_result = db.collection(u'parcels').where(u'customer_id', u'==', uid).get()

                plist = [(doc.id, doc.to_dict()['parcel_status'], doc.to_dict()['time_created'], doc.to_dict()['comment']) for doc in search_result]


                answ = jsonify(
                    action_response = 'list',
                    list = plist
                )
            else: 
                search_result = db.collection(u'parcels').document(parcel_id).get()

                answ = jsonify(
                    action_response = 'detail',
                    detail = search_result.to_dict()
                )
        except Exception as e:
            return ('error in post - list/detail: ' + str(e), 400, headers)
        else:
            return (answ, 200, headers)

def pd_suggestions(request):

    # Check authentification and set CORS preflight, as well as regular headers
    verification, http_code, message, headers = verify_request(request)
    if verification == False:
        return (message, http_code, headers)
    elif verification == True:
        uid = message[0]
        content = message[1]

    driver_position = content['driver_position']
    radius = int(content['radius'])*1000

    # Fetch available parcels from DB
    parcels_by_priority = db.collection(u'parcels').where(u'parcel_status', u'==', u'home').order_by(u'priority').limit(7).get()
    

    # Calculate driving distance to starting point
    now = datetime.now()
    possibleParcels = []
    
    tmp_dev_list = []

    for sParcel in parcels_by_priority:
        jParcel = sParcel.to_dict()
        directions_result = gmaps.directions((driver_position['lat'], driver_position['lng']),
                                            (jParcel['pickup_location']['lat'], jParcel['pickup_location']['lng']),
                                            mode="driving",
                                            avoid='ferries',
                                            departure_time=now)
        distance_to_pickup = directions_result[0]['legs'][0]['distance']['value']
        est_total_distance = int(jParcel['est_distance']) + int(distance_to_pickup)
        if int(distance_to_pickup) < radius:
            possibleParcels.append({
                "parcel_id": sParcel.id,
                "potential_earning": jParcel['price'],
                "size": jParcel['size'],
                "weight": jParcel['weight'],
                "distance_current_pickup": distance_to_pickup,
                "distance_pickup_destination": jParcel['est_distance']
            })
            jParcel['parcel_id'] = sParcel.id
            tmp_dev_list.append(jParcel)
    
    return (jsonify(possibleParcels), 200, headers)

@firestore.transactional
def helper_pd_parcel_selection_transaction(transaction, parcel_ref, driver_id):
    parcel_status_snapshot = parcel_ref.get(transaction=transaction).get(u'parcel_status')

    if parcel_status_snapshot == 'home':
        transaction.update(parcel_ref, {
            u'parcel_status': 'ready',
            u'driver_id': driver_id
        })
        return True
    else:
        return False

def pd_parcel_selection(request):
    # Check authentification and set CORS preflight, as well as regular headers
    verification, http_code, message, headers = verify_request(request)
    if verification == False:
        return (message, http_code, headers)
    elif verification == True:
        uid = message[0]
        content = message[1]
    
    try:
        selected_parcels = content['parcels']
    except Exception as e:
        selected_parcels = []

    # make sure use doesn't have any open jobs
    jobs = db.collection(u'jobs').where(u'driver_id', u'==', uid).where(u'job_status', u'==', 'created').get()
    jobs = list(jobs)
    if len(jobs) > 0:
        return ("[]", 200, headers)

    # Start Firebase Transaction to ensure consistency
    accepted_parcels = []
    # Validate, that all parcels are still available aka status = home
    if len(selected_parcels) == 0:
        return ('[]', 200, headers)
    
    for parcel_id in selected_parcels:
        transaction = db.transaction()
        parcel_ref = db.collection(u'parcels').document(parcel_id)
        check_ndate = helper_pd_parcel_selection_transaction(transaction, parcel_ref, uid)
        if check_ndate:
            accepted_parcels.append(parcel_id)

    if len(accepted_parcels) > 0:
        time_created = datetime.now()

        doc_ref = db.collection(u'jobs').document()
        doc_ref.set({
            u'driver_id': uid,
            u'time_created': time_created,
            u'selected_parcels': accepted_parcels,
            u'job_status': 'created'
        })
        
        job_id = doc_ref.id
        answ = jsonify(
            job_id = job_id
        )
        return (answ, 200, headers)
    else:
        return ("No parcels available", 200, headers)

def pd_status(request):
    # Check authentification and set CORS preflight, as well as regular headers
    verification, http_code, message, headers = verify_request(request)
    if verification == False:
        return (message, http_code, headers)
    elif verification == True:
        uid = message[0]
        content = message[1]

    driver_location = content['current_location']
    parcel_id = content['parcel_id']

    # User has interacted with one of the parcels either pickup or delivery
    if parcel_id != '':
        parcel_ref = db.collection(u'parcels').document(parcel_id)
        parcel_details = parcel_ref.get().to_dict()
        parcel_status = parcel_details['parcel_status']
       
        if parcel_status == 'ready':
            parcel_ref.update({
                u'parcel_status': 'delivery'
            })

        elif parcel_status == 'delivery':
            parcel_ref.update({
                u'parcel_status': 'submitted'
            })

    # Check drivers active Job
    jobs_ref = db.collection(u'jobs').where(u'driver_id', u'==', uid).where(u'job_status', u'==', 'created')
    jobs = list(jobs_ref.get())
    if len(jobs) != 1:
        return ("[]", 200, headers)
    job = jobs[0].to_dict()
    job_id = jobs[0].id

    # Create Available Location Array - find locations that are applicaple for delivery
    accessible_locations = []
    focus_parcels = job['selected_parcels']
    # Validate, that all parcels are still available aka status = home
    for parcel_id in focus_parcels:
        parcel_details = db.collection(u'parcels').document(parcel_id).get().to_dict()
        parcel_status = parcel_details['parcel_status']

        if parcel_status == 'ready':
            # Parcel is ready, add pickup_location to accessible_locations
            accessible_locations.append((parcel_id, parcel_details['pickup_location']))

        elif parcel_status == 'delivery':
            # Parcel is in posession, add destination_location to accessible_locations
            accessible_locations.append((parcel_id, parcel_details['destination_location']))

    # If array is empty, job terminates with success. Change status, notify user
    if len(accessible_locations) == 0:
        db.collection(u'jobs').document(job_id).update({
                u'job_status': 'finished'
        })
        return ('[]', 200, headers)

    # Calculate closest parcel and best waypoint
    stripped_loc = [(parcel[1]['lat'], parcel[1]['lng'])
                            for parcel in accessible_locations]

    calc_best = gmaps.directions(origin=(driver_location['lat'], driver_location['lng']),
                            destination=(driver_location['lat'], driver_location['lng']),
                            waypoints=stripped_loc,
                            mode='driving',
                            departure_time=datetime.now(),
                            optimize_waypoints=True)


    # [ 0, 2, 1]
    best_parcel_index = calc_best[0]['waypoint_order']
    
    # (pid, [loc])
    actual_best = accessible_locations[best_parcel_index[0]]
    parcel_id = actual_best[0]
    location = actual_best[1]

    # Get Parcel Details
    search_result = db.collection(u'parcels').document(parcel_id).get()
    parcel_details =  search_result.to_dict()
    
    answ = jsonify(
        parcel_id = parcel_id,
        location = location,
        parcel_state = "Pickup" if parcel_details['parcel_status'] == 'ready' else "Deliver",
        parcel_comment = parcel_details['comment'],
        parcel_weight = parcel_details['weight'],
        parcel_size = parcel_details['size'] 
    )

    return (answ, 200, headers)

def pd_job(request):

    # Check authentification and set CORS preflight, as well as regular headers
    verification, http_code, message, headers = verify_request(request)
    if verification == False:
        return (message, http_code, headers)
    elif verification == True:
        uid = message[0]

    jobs = db.collection(u'jobs').where(u'driver_id', u'==', uid).where(u'job_status', u'==', 'created').get()
    jobs = list(jobs)
    if len(jobs) != 1:
        return ("[]", 200, headers)

    # check if generator empty
    job = jobs[0].to_dict()

    answ = jsonify(
        job_id = jobs[0].id,
        time_created = job['time_created'],
        parcels = job['selected_parcels']
    )
    return (answ, 200, headers)

def pd_job_history(request):
    # Check authentification and set CORS preflight, as well as regular headers
    verification, http_code, message, headers = verify_request(request)
    if verification == False:
        return (message, http_code, headers)
    elif verification == True:
        uid = message[0]

    jobs = db.collection(u'jobs').where(u'driver_id', u'==', uid).where(u'job_status', u'==', 'finished').get()
    jobs = list(jobs)

    jobs = [job.to_dict() for job in jobs]

    answ = jsonify(
        jobs = jobs
    )
    return (answ, 200, headers)

def pd_rating(request):
    # Get user_token, return ratings of all drivers

    # Check authentification and set CORS preflight, as well as regular headers
    verification, http_code, message, headers = verify_request(request)
    if verification == False:
        return (message, http_code, headers)
    elif verification == True:
        uid = message[0]

    all_jobs = db.collection(u'jobs').where(u'job_status', u'==', 'finished').order_by(u'driver_id').get()

    # Create Tuple (id, amount) for each job
    driver_parcels = [ [job.to_dict()['driver_id'], len(job.to_dict()['selected_parcels'])] for job in all_jobs]
    
    previous_id = ""
    driver_sum = []
    for driver_id, parcel_count in driver_parcels:
        if driver_id == previous_id:
            # Get last item (parcel count) and append the new one
            driver_sum[-1][-1] += parcel_count
        else:
            name = auth.get_user(driver_id).display_name
            driver_sum.append([driver_id, name, parcel_count])
        previous_id = driver_id

    return (jsonify(driver_sum), 200, headers)

def pd_parcel_status(request):

    # Check authentification and set CORS preflight, as well as regular headers
    verification, http_code, message, headers = verify_request(request)
    if verification == False:
        return (message, http_code, headers)
    elif verification == True:
        uid = message[0]
        content = message[1]

    parcel_id = content['parcel_id'] 
    parcel_status = content['parcel_status'] 

    return ""
 
def parcelPriceCalculator(size, weight, est_driving_distance, priority):


    km_factor = 0

    if(size=='L'):
        km_factor += 0.2
    elif(size == 'M'):
        km_factor += 0.1
    elif(size == 'S'):
        km_factor += 0.05
    else:
        raise ValueError('Size not supported. Has to be L, M or S')

    if(weight=='heavy'):
        km_factor += 0.2
    elif(weight == 'medium'):
        km_factor += 0.1
    elif(weight == 'light'):
        km_factor += 0.05
    else:
        raise ValueError('Weight not supported. Has to be heavy, medium, light')
    # Benzin Addition
    km_factor += 0.15

    # Driver Additional
    km_factor += 0.1

    # Net Price
    net_price = (est_driving_distance/1000) * km_factor

    # Our margin
    return round(net_price * 1.05, 2)

