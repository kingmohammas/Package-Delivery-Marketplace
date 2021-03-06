import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import Login from "./SignIn/index";
import SignUp from "./SignUp/index";
import Profile from "./People/Profile";
import Package from "./PackageInsert/Package"
import SelectPackages from "./Driver/SelectPackages"
import Driver from "./Driver/Driver"
import ConfirmPage from "./Driver/ConfirmPage"
import ProfileEdit from "./People/ProfileEdit";
import FinalPage from "./FinalPage";
import DriverRoute from "./Driver/DriverRoute"
import MyPackages from "./PackageInsert/MyPackages"
import MyDrives from "./Driver/MyDrives"
import Ratings from "./People/Ratings"
import PackageDetails from "./PackageInsert/PackageDetails"
import {BrowserRouter, Route, Switch} from 'react-router-dom';
import * as serviceWorker from './serviceWorker';
import Firebase, { FirebaseContext } from './Firebase';
require('dotenv').load();

ReactDOM.render(
    <FirebaseContext.Provider value={new Firebase()}>
        <BrowserRouter>
            <Switch>
                <Route exact path="/" component={App}></Route>
                <Route exact path="/login" component={Login}></Route>
                <Route exact path="/signup" component={SignUp}></Route>
                <Route exact path="/profile" component={Profile}></Route>
                <Route exact path="/ratings" component={Ratings}></Route>
                <Route exact path="/profile-edit" component={ProfileEdit}></Route>
                <Route exact path="/new-package" component={Package}></Route>
                <Route exact path="/packages" component={MyPackages}></Route>
                <Route exact path="/package-details" component={PackageDetails}></Route>
                <Route exact path="/drives" component={MyDrives}></Route>
                <Route exact path="/driver-select-packages" component={SelectPackages}></Route>
                <Route exact path="/driver" component={Driver}></Route>
                <Route exact path="/driver-confirm" component={ConfirmPage}></Route>
                <Route exact path="/driver-route" component={DriverRoute}></Route>
                <Route exact path="/final" component={FinalPage}></Route>
            </Switch>
        </BrowserRouter>
    </FirebaseContext.Provider>, document.getElementById('root')
    );

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
