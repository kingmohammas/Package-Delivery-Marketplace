import React, { Component } from "react";
import Navigation from "../components/Navigation";
import Header from "../components/Header";
import "../App.css";
import { sendPostRequest } from "../API/Requests";
import { withAuthentication, AuthUserContext } from "../Session";

export class ConfirmationPage extends Component {
  constructor() {
    super();

    this.state = {
      selectedPackages: [],
      timeAvailable: 0,
      currentLatLng: {
        lat: "",
        lng: ""
      },
      waypoints: [],
      destination: ""
    };
    this.ReturnToPreviousPage = this.ReturnToPreviousPage.bind(this);
    this.continueToFinalPage = this.continueToFinalPage.bind(this);
  }

  componentWillMount() {
    if (this.props.location.state) {
      this.setState({
        selectedPackages: this.props.location.state.selectedPackages,
        radius: this.props.location.state.prevState.radius,
        currentLatLng: this.props.location.state.prevState.currentLatLng,
        userToken: this.props.location.state.userToken,
        formattedAddress: this.props.location.state.formattedAddress
      });
    }
  }

  componentDidMount() {
    document.title = "Confirm your delivery - Package Delivery Marketplace"
    if(this.state.selectedPackages.length > 0){
      this.state.selectedPackages.map((entry) => {
        this.getUserPackages(entry.parcel_id)
      })
    }
    
    this.sendSelectedPackages();
  }

  ReturnToPreviousPage() {
    this.props.history.push({
      pathname: "/driver-select-packages",
      state: {
        selectedPackages: this.state.selectedPackages
      }
    });
  }

  async sendSelectedPackages(){
    let allPackageIDs = [];
    this.state.selectedPackages.map((key, index) => {
        allPackageIDs.push(key.parcel_id)
    })

    let data = JSON.stringify({
      user_token: this.state.userToken,
      parcels: allPackageIDs
    });

    let response = await sendPostRequest("pd_parcel_selection", data);

  }


  async getUserPackages(packageID) {
    //Wrap data into object

    let data = JSON.stringify({
      user_token: this.state.userToken,
      action: "detail",
      parcel_id: packageID
    });

    let response = await sendPostRequest("parcel", data)
    if(response !== null){
      this.state.waypoints.push({
        coords: response.data.detail.pickup_location,
        destination: response.data.detail.destination_location,
        parcel_id: packageID,
        distance_current_pickup: ""
      });
      this.setState({
        destination: response.data.detail.destination_location
      })
    }else{
      console.log("Error fetching data")
    }
    //Send HTTP Post request

  }

  continueToFinalPage() {
    this.props.history.push({
      pathname: "/driver-route",
      state: {
        selectedPackages: this.state.selectedPackages,
        currentLatLng: this.state.currentLatLng,
        userToken: this.state.userToken,
        waypoints: this.state.waypoints,
        destination: this.state.destination
      }
    });
  }

  render() {
    if (this.state.selectedPackages) {
      return (
        <div className="App">
          <Header />
          <Navigation currentPage="delivery" />
          <div className="main-content">
            <AuthUserContext.Consumer>
              {authUser =>
                authUser ? (
                  <div className="tile">
                    <h2>Congrats! Check your information and submit</h2>
                    <div>
                      <p style={{ marginBottom: "30px" }}>
                        <span style={{ fontWeight: 600 }}>
                          Your selected radius is:
                        </span><br/>
                        {this.state.radius} km
                      </p>
                      <p style={{ marginBottom: "30x" }}>
                        <span style={{ fontWeight: 600 }}>
                          Your current location is:
                        </span> <br/>
                        {this.state.formattedAddress} <br/>
                        {this.state.currentLatLng.lat.toFixed(4)} ,{" "}
                        {this.state.currentLatLng.lng.toFixed(4)}
                      </p>
                      <p>
                        <span style={{ fontWeight: 600 }}>
                          You selected the following packages to deliver:
                        </span>
                      </p>
                      {this.state.selectedPackages.map((p, index) => {
                        return (
                          <div className="listed-packages" key={index}>
                            <span
                              id="packages-table-heading"
                              className="packages-table"
                            >
                              <img
                                style={{
                                  width: "28px",
                                  top: "8px",
                                  position: "relative",
                                  marginRight: "8px"
                                }}
                                alt="Shows an a route with multiple waypoints."
                                src="/assets/box.png"
                              />
                              Package {index + 1}
                            </span>
                            <span className="packages-table">
                              <b>
                                {(p.distance_current_pickup / 1000).toFixed(2)}{" "}
                                km{" "}
                              </b>{" "}
                              Your location - Pickup
                            </span>
                            <span className="packages-table">
                              <b>
                                {(p.distance_pickup_destination / 1000).toFixed(
                                  2
                                )}{" "}
                                km{" "}
                              </b>{" "}
                              Pickup - Destination
                            </span>
                            <span
                              className="packages-table"
                              style={{
                                fontSize: "18px",
                                display: "inline-block"
                              }}
                            >
                              <b>
                                {(
                                  p.distance_pickup_destination / 1000 +
                                  p.distance_current_pickup / 1000
                                ).toFixed(2)}{" "}
                                km{" "}
                              </b>{" "}
                              Combined
                            </span>
                            <span style={{ float: "right", fontSize: "20px" }}>
                              <b> {(p.potential_earning).toFixed(2)} € </b>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      className="buttons"
                      onMouseDown={this.ReturnToPreviousPage}
                    >
                      Back
                    </button>
                    <button
                      className="buttons cta-button"
                      onMouseDown={this.continueToFinalPage}
                      style={{ float: "right" }}
                    >
                      Confirm
                    </button>
                  </div>
                ) : (
                  <div className="tile">
                    <div className="userNotLoggedIn-label">
                      Please log in to access this page.
                    </div>
                  </div>
                )
              }
            </AuthUserContext.Consumer>
          </div>
        </div>
      );
    }
  }
}

export default withAuthentication(ConfirmationPage);
