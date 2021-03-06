// Observe raw event from Firebase
observeAllEventsFromFirebase = function() {
  Companies.find().observe({
    "added": function(company) {
      var firebaseRef = new Firebase(company.systemConfig.firebase.root);
      firebaseRef.auth(company.systemConfig.firebase.rootSecret, Meteor.bindEnvironment(function(error, result) {
        if (error) {
          console.error("Login Failed!", error);
        } else {
          console.info('Authenticated successfully with payload:', result.auth);
          console.info('Auth expires at:', new Date(result.expires * 1000));
          observeBeaconEventsFromFirebase(company);
          observeEngagementEventsFromFirebase(company);
          observeVisitorEventsFromFirebase(company);
        }
      }));
    }
  });
};

observeBeaconEventsFromFirebase = function(company) {
  observeCompanyChildAdded("beacon_events", company, function(childSnapshot, prevChildName) {
    processBeaconEventFromFirebase(company._id, childSnapshot, Meteor.settings.removeFromFirebase);
  });
};

observeEngagementEventsFromFirebase = function(company) {
  observeCompanyChildAdded("engagement_events", company, function(childSnapshot, prevChildName) {
    processEngagementEventFromFirebase(childSnapshot, Meteor.settings.removeFromFirebase);
  });
};

observeVisitorEventsFromFirebase = function(company) {
  observeCompanyChildAdded("visitor_events", company, function(childSnapshot, prevChildName) {
    processVisitorEventFromFirebase(company._id, childSnapshot, Meteor.settings.removeFromFirebase);
  });
};

var observeCompanyChildAdded = function(path, company, callback) {
  var companyId = company._id;
  var fbPath = company.systemConfig.firebase.root + '/companies/' + companyId + '/' +  path;
  var firebase = new Firebase(fbPath);
  console.log('[Remote] Observing company child_added:', companyId, fbPath);
  firebase.on('child_added', Meteor.bindEnvironment(callback));
};

var processVisitorEventFromFirebase = function(companyId, snapshot, removeFromFirebase) {
  var visitorEventJSON = snapshot.val();

  console.log('[Remote] processVisitorEventFromFirebase. New event: ', JSON.stringify(visitorEventJSON));

  switch (visitorEventJSON.type) {
    case "identify":
      Visitors.identifyUser(companyId, visitorEventJSON.visitor_uuid, visitorEventJSON.external_id);
      break;
    case "tag":
      Visitors.tagUser(companyId, visitorEventJSON.visitor_uuid, visitorEventJSON.properties);
      break;
    default:
      console.warn('[Remote] processVisitorEventFromFirebase. Invalid type: ', visitorEventJSON.type);
  }

  if (removeFromFirebase) {
    snapshot.ref().remove();
  }
};

var processEngagementEventFromFirebase = function(snapshot, removeFromFirebase) {
  var engagementEventJSON = snapshot.val();

  Message.markAsRead(engagementEventJSON.message_id, Date.parse(engagementEventJSON.created_at));

  if (removeFromFirebase) {
    snapshot.ref().remove();
  }
};

var processBeaconEventFromFirebase = function(companyId, snapshot, removeFromFirebase) {
  var beaconEventJSON = snapshot.val();
  var visitor = Visitors.findOneOrCreate({
    companyId: companyId,
    uuid: beaconEventJSON.visitor_uuid
  });
  // console.log("[processBeaconEventFromFirebase] Processing BeaconEvent["+beaconEventJSON._id+"] from Visitor["+visitor._id+"]");

  var beacon = Beacons.findOne({uuid: beaconEventJSON.uuid,
                                major: beaconEventJSON.major,
                                minor: beaconEventJSON.minor});
  if (!beacon || !beacon._id) {
    console.warn("[processBeaconEventFromFirebase] can't find beacon: " + JSON.stringify(beaconEventJSON));
    return;
  }

  var sessionId = beaconEventJSON.session_id;
  var beaconEvent = new BeaconEvent(visitor._id, beacon._id, sessionId, beaconEventJSON);
  if (beaconEvent.save()) {
    // Remove the copy on Firebase so we will not re process the
    // beacon event on restart
    if (removeFromFirebase) {
      removeBeaconEventFromFirebase(snapshot.ref());
    }
  }
}

var removeBeaconEventFromFirebase = function(beaconEventRef) {
  // beaconEventRef can be passed in as DataSnapshot
  var fbPath = new Firebase(beaconEventRef.toString());
  fbPath.remove();
}
