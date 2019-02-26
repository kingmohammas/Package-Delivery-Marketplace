/*global google*/

import React, { Component } from "react";
import "../App.css";
import { withAuthentication } from "../Session";
import {sendPostRequest} from "../API/Requests"
import Script from "react-load-script";
require("dotenv").config();

export class Maps extends Component {
  constructor() {
    super();
    this.state = {
      startLocation: {
        lat: null,
        lng: null
      },
      destination: {
        lat: null,
        lng: null
      },
      googleAPIKey: process.env.REACT_APP_GOOLE_API_KEY,
      currentLatLng: {
        lat: null,
        lng: null
      },
      directionsService: null,
      directionsDisplay: null,
      place: null,
      mapPositionArray: [],
      allowMultipleClicks: true,
      allowSingleClicks: true,
      showAutoCompleteBar: true,
      duration: "",
      distance: "",
      scriptLoaded: false,
      waypoints: [],
      numberOfClicksAllowed: 2,
      coordinates: {
        lat: 48.78232,
        lng: 9.17702
      },
      openPackages: [],
      pickedUpPackages: [],
      pickedUpClicked: false,
      currentPackageState: "",
      jobResponse: {
        parcel_id: "",
        location: null
      },
      pickUpButtonClass: "buttons",
      pickUpButtonText: "Next Pickup",
      buttonCliked: false
    };

    this.initAutocomplete = this.initAutocomplete.bind(this);
    this.initMap = this.initMap.bind(this);
    this.calculateAndDisplayRoute = this.calculateAndDisplayRoute.bind(this);

    this.successDiv = React.createRef();
    this.pickUpButton = React.createRef();
    
    let map, geocoder, lastDestination;
  }

  componentWillMount() {
    //this.getGeoLocation();

    if (this.props.numberOfClicksAllowed) {
      this.setState({
        numberOfClicksAllowed: parseInt(this.props.numberOfClicksAllowed, 10)
      });
    }
    if (this.props.showAutoCompleteBar === "false") {
      this.setState({
        showAutoCompleteBar: false
      });
    }

    if (this.props.startLocation) {
      this.setState({
        startLocation: this.props.startLocation,
        destination: this.props.destination
      });
    }
    if (this.props.waypoints) {
      this.setState({
        waypointsDetails: this.props.waypoints
      });
      
      for (let i = 0; i < this.props.waypoints.length; i++) {
        this.state.waypoints.push({
          location: this.props.waypoints[i].coords,
          stopover: true
        });
      }
    }
    this.setState({
      pickedUpClicked: this.props.pickedUpClicked
    })
  }

  componentDidMount() {
    if (this.props.calculateRoute === "true") {
      setTimeout(
        function() {
          this.calculateAndDisplayRoute();
        }.bind(this),
        50
      );
    }
  }

  initMap() {
    this.geocoder = new google.maps.Geocoder();

    //Create the map component
    this.map = new google.maps.Map(document.getElementById("map"), {
      center: {
        lat: this.state.coordinates.lat,
        lng: this.state.coordinates.lng
      },
      zoom: 10
    });

    // Add Event listener to map
    // Create new Info Window and Marker for each clicked location
    google.maps.event.addListener(
      this.map,
      "click",
      function(event) {
        if (this.state.numberOfClicksAllowed > 0) {
          this.addInfoWindowForLocation(event, this.geocoder);
        }
      }.bind(this)
    );

    this.setState({
      directionsService: new google.maps.DirectionsService(),
      directionsDisplay: new google.maps.DirectionsRenderer({
        map: this.map
      })
    });

    //Initialize the autocomplete text field
    if (this.state.showAutoCompleteBar) {
      this.initAutocomplete(this.geocoder);
    }
  }

  xy = openPackages => {
    return new Promise((res, rej) => {
      let routeTimes = [];

      for (let i = 0; i < openPackages.length; i++) {
        this.state.directionsService.route(
          {
            origin: this.state.startLocation,
            destination: openPackages[i].location,
            travelMode: google.maps.TravelMode.DRIVING
          },
          function(response, status) {
            if (status === google.maps.DirectionsStatus.OK) {
              this.state.directionsDisplay.setDirections(response);
              let duration = 0;

              let dirRoutes = this.state.directionsDisplay.directions;
              for (let i = 0; i < dirRoutes.routes[0].legs.length; i++) {
                duration += dirRoutes.routes[0].legs[i].duration.value;
              }
              routeTimes.push({
                duration: duration,
                location: openPackages[i]
              });

              res(routeTimes);
            } else {
              alert("No routes found");
              rej("No route found");
            }
          }.bind(this)
        );
      }
    });
  };

  async oldAlgo() {
    let wayPts = this.state.waypoints;
    let openPackages = this.state.openPackages;
    for (let i = 0; i < wayPts.length; i++) {
      this.state.openPackages.push(wayPts[i]);
    }

    //while(openPackages.length > 0) {

    const routeTimes = await this.xy(openPackages);

    //Get min value of array

    var minOfArray = Number.POSITIVE_INFINITY;
    var tmp;
    for (var i = routeTimes.length - 1; i >= 0; i--) {
      tmp = routeTimes[i].duration;
      if (tmp < minOfArray) minOfArray = tmp;
    }
    console.log(minOfArray);

    let index = 0;
    for (let i = 0; i < routeTimes.length; i++) {
      if (routeTimes[i].duration === minOfArray) {
        index = i;
      }
    }

    console.log(index);
    console.info(minOfArray);
    console.log(this.state.startLocation);
    console.log(routeTimes);
  }

  drawRouteOnMaps = (origin, destination, waypoint, setMap) => {
    return new Promise((res, rej) => {

      if (this.state.directionsService && this.state.directionsDisplay) {
        this.state.directionsDisplay.setMap(null);
        this.state.directionsDisplay.setMap(this.map);
  
        if (waypoint !== null) {
          this.state.directionsService.route(
            {
              origin: origin,
              destination: destination,
              waypoints: waypoint,
              travelMode: google.maps.TravelMode.DRIVING
            },
            function(response, status) {
              if (status === google.maps.DirectionsStatus.OK) {
                this.handleDirectionsResponse(response);
                res("success")
              }else{
                rej("error")
              }
            }.bind(this)
          );
        } else {
          this.state.directionsService.route(
            {
              origin: origin,
              destination: destination,
              travelMode: google.maps.TravelMode.DRIVING
            },
            function(response, status) {
              if (status === google.maps.DirectionsStatus.OK) {
                this.handleDirectionsResponse(response);
                res("Success")
              }else{
                rej("error")
              }
            }.bind(this)
          );
        }
        if (!setMap) {
          this.state.directionsDisplay.setMap(null);
        }
      }
    })
  }

  handleDirectionsResponse(response) {
    let totalDistance = 0;
    let totalDuration = 0;

    this.state.directionsDisplay.setDirections(response);
  
    let dirRoutes = this.state.directionsDisplay.directions;
    for (let i = 0; i < dirRoutes.routes[0].legs.length; i++) {
      totalDistance += dirRoutes.routes[0].legs[i].distance.value;
      totalDuration += dirRoutes.routes[0].legs[i].duration.value;
    }

    let roundedTotalDistance = totalDistance / 1000;
    roundedTotalDistance = roundedTotalDistance.toFixed(1);

    var date = new Date(null);
    date.setSeconds(totalDuration); // specify value for SECONDS here
    var resultTime = 0;
    if (totalDuration < 3600) {
      resultTime = date.toISOString().substr(14, 5);
    } else {
      resultTime = date.toISOString().substr(11, 8);
      resultTime = date.toISOString().substr(11, 8);
    }

    this.setState({
      duration: resultTime,
      distance: roundedTotalDistance + " km"
    });
  }

  calculateAndDisplayRoute = async(e) => {
    if (this.state.waypoints.length > 1) {
      this.setState({pickUpButtonText: "Next Pickup"})
      console.log("inside");
      let data = JSON.stringify({
        user_token: this.props.userToken,
        current_location: this.state.startLocation,
        parcel_id: this.state.jobResponse.parcel_id
      });


      let response = await sendPostRequest("pd_status", data);

      if(response.data){
        if(response.data.length===0){
          this.routeFinished();
        }else{
          this.setState({
            jobResponse: {
              parcel_id: response.data.parcel_id,
              location: response.data.location
            }
          })
          console.log(response)
    
          this.drawRouteOnMaps(this.state.startLocation, this.state.jobResponse.location, null, true);      
    
          this.setState({
            startLocation: this.state.jobResponse.location
          })
        }
      }
  
    } else {
      if(!this.state.buttonCliked){
        if (this.state.directionsService && this.state.directionsDisplay) {
          this.setState({
            pickUpButtonText: "Delivered",
            buttonCliked: true
          })
          this.state.directionsDisplay.setMap(null);
          this.state.directionsDisplay.setMap(this.map);
          this.drawRouteOnMaps(this.state.startLocation,this.state.destination, this.state.waypoints, true);      
        }
      }else{
        this.routeFinished();
      }
    }
  };

  routeFinished() {
    this.successDiv.current.style.display = "inherit";
    this.state.directionsDisplay.setMap(null);

    this.pickUpButton.current.disabled = true;
    this.setState({
      pickUpButtonClass: "button-disabled"
    })
  }

  /**
   * Initialize Autocomplete input
   */
  initAutocomplete(geocoder) {
    if (this.map) {
      let input = document.getElementById("searchTextField");
      let marker = new google.maps.Marker({
        map: this.map
      });

      let autocomplete = new google.maps.places.Autocomplete(input);
      autocomplete.bindTo("bounds", this.map);

      google.maps.event.addListener(
        autocomplete,
        "place_changed",
        function() {
          this.place = autocomplete.getPlace();

          var newlatlong = new google.maps.LatLng(
            this.place.geometry.location.lat(),
            this.place.geometry.location.lng()
          );
          this.map.setCenter(newlatlong);

          this.checkIfInfoWindowIsReached();
          this.createNewInfoWindow(
            this.place.geometry.location.lat(),
            this.place.geometry.location.lng(),
            geocoder
          );

          if (this.props.callbackFromDriver) {
            this.props.callbackFromDriver({
              lat: this.place.geometry.location.lat(),
              lng: this.place.geometry.location.lng()
            });
          } else if (this.props.callbackFromParent) {
            this.props.callbackFromParent(this.state.coordinates);
          }

          this.map.setZoom(11);
        }.bind(this)
      );
    }
  }

  /**
   * Adds an Info Window when clicked on the map with the named address
   */
  addInfoWindowForLocation(event, geocoder) {
    var infoWindow;

    //Check, whether an Info Window already exists for the current location
    for (let i = 0; i < this.state.mapPositionArray.length; i++) {
      if (
        this.state.mapPositionArray[i].lat === event.latLng.lat() &&
        this.state.mapPositionArray[i].lon === event.latLng.lng()
      ) {
        infoWindow = this.state.mapPositionArray[i].infoWindow;
      }
      if (this.state.mapPositionArray[i].infoWindow) {
        this.state.mapPositionArray[i].infoWindow.close();
      }
    }

    this.checkIfInfoWindowIsReached();

    // If no Info Window exists yet, create a one
    if (!infoWindow) {
      this.createNewInfoWindow(
        event.latLng.lat(),
        event.latLng.lng(),
        geocoder
      );
    }

    if (this.props.callbackFromParent) {
      this.props.callbackFromParent(this.state.mapPositionArray);
    } else if (this.props.callbackFromDriver) {
      this.props.callbackFromDriver({
        lat: event.latLng.lat(),
        lng: event.latLng.lng()
      });
    }
  }

  checkIfInfoWindowIsReached() {
    if (
      this.state.mapPositionArray.length >
      this.state.numberOfClicksAllowed - 1
    ) {
      for (let i = 0; i < this.state.mapPositionArray.length; i++) {
        this.state.mapPositionArray[i].marker.setMap(null);
      }
      this.setState({
        mapPositionArray: []
      });
    }
  }

  createNewInfoWindow(lat, lng, geocoder) {
    let infoWindow, marker;
    var latlng = { lat: lat, lng: lng };
    let mapPosition = {
      lat: lat,
      lon: lng,
      infoWindow: new google.maps.InfoWindow(),
      marker: new google.maps.Marker({
        position: latlng,
        map: this.map
      })
    };

    let newMapPositions = this.state.mapPositionArray;
    newMapPositions.push(mapPosition);
    this.setState({
      mapPositionArray: newMapPositions
    });
    infoWindow = mapPosition.infoWindow;
    marker = mapPosition.marker;

    this.geocodeLatLng(geocoder, this.map, infoWindow, latlng, marker);
  }

  /*
        Get address from coordinates
    */
  geocodeLatLng(geocoder, map, infowindow, coordinates, marker) {
    var latlng = { lat: coordinates.lat, lng: coordinates.lng };
    geocoder.geocode(
      { location: latlng },
      function(results, status) {
        if (status === "OK") {
          if (results[0]) {
            marker.addListener("click", function() {
              infowindow.open(map, marker);
            });

            this.formatted_address = results[0].formatted_address;
            if (this.props.getFormattedAddress) {
              this.props.getFormattedAddress(results[0].formatted_address);
            }
            infowindow.setContent(results[0].formatted_address);
            infowindow.open(map, marker);
          } else {
            window.alert("No results found");
          }
        } else {
          window.alert("Geocoder failed due to: " + status);
        }
      }.bind(this)
    );
  }

  render() {
    let googleMapURL =
      "https://maps.googleapis.com/maps/api/js?libraries=places&key=" +
      this.state.googleAPIKey;

    return (
      <div>
        <div className="success-div" style={{display: "none"}} ref={this.successDiv}>
          Congratulations! You delivered all packages successfully.
        </div>
        {this.state.showAutoCompleteBar ? (
          <input type="text" id="searchTextField" />
        ) : (
          ""
        )}
        <div id="map" />
        <div>
          {this.props.calculateRoute ? (
            <div
              style={{
                margin: "20px 0",
                overflow: "hidden",
                marginLeft: "-24px"
              }}
            >
              <div style={{ float: "left" }}>
                <img
                  style={{
                    width: "38px",
                    marginLeft: "28px",
                    position: "relative",
                    top: "16px"
                  }}
                  alt="Shows an icon of a person"
                  src="/assets/distance1.png"
                />
                <span
                  style={{
                    fontSize: "18px",
                    marginLeft: "15px",
                    fontWeight: 600
                  }}
                >
                  {this.state.distance}
                </span>
                <span className="route-details" ref={this.distanceLabel}>
                  Distance
                </span>
              </div>
              <div style={{ marginLeft: "20px", overflow: "hidden" }}>
                <img
                  style={{
                    width: "38px",
                    marginLeft: "28px",
                    position: "relative",
                    top: "20px"
                  }}
                  alt="Shows an icon of a person"
                  src="/assets/duration.png"
                />
                <span
                  style={{
                    fontSize: "18px",
                    marginLeft: "15px",
                    fontWeight: 600
                  }}
                >
                  {this.state.duration}
                </span>
                <span className="route-details" ref={this.durationLabel}>
                  Duration{" "}
                </span>
                <div>
                  {this.state.currentPackageState}
                </div>
              </div>
              <button 
              className={this.state.pickUpButtonClass} 
              ref={this.pickUpButton} 
              onClick={this.calculateAndDisplayRoute}
              style={{marginTop: "20px", marginBottom: 0, marginLeft: "20px"}}
              >{this.state.pickUpButtonText}</button>
            </div>
          ) : (
            ""
          )}
        </div>
        <Script url={googleMapURL} onLoad={this.initMap.bind(this)} />
      </div>
    );
  }
}

export default withAuthentication(Maps);
