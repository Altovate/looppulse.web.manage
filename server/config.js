configure = function() {
  console.info("Configuring with Meteor.settings: " + JSON.stringify(Meteor.settings));

  if (JSON.stringify(Meteor.settings)=='{}') {
    console.warn("Meteor.settings expected. Rerun: meteor --settings server/settings.json");

    // We can try to read the file using
    // https://gist.github.com/awatson1978/4625493
  }

  configureDEBUG();
}

ensureIndexes = function() {
  var classes = [BeaconEvent, Encounter, Installation, Visitor];
  classes.forEach(
    function(objectClass) {
      if (objectClass.hasOwnProperty('ensureIndex')) {
        objectClass.ensureIndex();
      }
    }
  )
}

// TODO: We need to observe other changes in company.
observeCompaniesFromFirebase = function() {
  var fbPath = Meteor.settings.firebase.config + '/companies';
  var companiesRef = new Firebase(fbPath);
  console.log("[Remote] Observing for company addition: "+ fbPath);
  companiesRef.on(
    "child_added",
    Meteor.bindEnvironment(
      function(childSnapshot, prevChildName) {
        createCompany(childSnapshot, Meteor.settings.removeFromFirebase);
      }
    )
  );
}

var createCompany = function(snapshot, removeFromFirebase) {
  var companyConfig = snapshot.val();
  var company = new Company(companyConfig.name, companyConfig.logoUrl);
  companyConfig._id = company.save();
  console.info("[Init] Company created:", company._id, company.name);

  _.each(companyConfig.products, function(productConfig, productKey) {
    var p = new Product(productConfig.name, company._id);
    companyConfig.products[productKey]._id = p.save();
    console.info("[Init] Product created:", p._id, p.name);
  });

  _.each(companyConfig.entrances, function(entranceConfig, entranceKey) {
    var p = new Entrance(entranceConfig.name, company._id);
    companyConfig.entrances[entranceKey]._id = p.save();
    console.info("[Init] Entrance created:", p._id, p.name);
  });

  _.each(companyConfig.cashiers, function(cashierConfig, cashierKey) {
    var p = new Cashier(cashierConfig.name, company._id);
    companyConfig.cashiers[cashierKey]._id = p.save();
    console.info("[Init] Cashier created:", p._id, p.name);
  });

  _.each(companyConfig.beacons, function(beaconConfig, beaconKey) {
    var b = new Beacon(beaconConfig.uuid, beaconConfig.major, beaconConfig.minor);
    companyConfig.beacons[beaconKey]._id = b.save();
    console.info("[Init] Beacon created:", JSON.stringify(b));
  });

  _.each(companyConfig.locations, function(locationConfig, locationKey) {
    var l = new Location(locationConfig.name, locationConfig.address, company._id);
    companyConfig.locations[locationKey]._id = l.save();
    console.info("[Init] Location created:", l._id, l.name);

    _.each(locationConfig.installations, function(installationConfig) {
      var type = installationConfig.type;
      var locationId = l._id;
      var beaconId = companyConfig.beacons[installationConfig.beacon]._id;
      var physicalId = undefined;
      if (type === 'product') {
        physicalId = companyConfig.products[installationConfig.product]._id;
      } else if (type === 'entrance') {
        physicalId = companyConfig.entrances[installationConfig.entrance]._id;
      } else if (type === 'cashier') {
        physicalId = companyConfig.cashiers[installationConfig.cashier]._id;
      }
      var i = new Installation(type, locationId, beaconId, physicalId);
      i.save();
      console.info("[Init] Installation created:", JSON.stringify(i));
    });
  });

  if (removeFromFirebase) {
    removeCompanyFromFirebase(snapshot.ref());
  }
}

// TODO: refactor w/ removeBeaconEventFromFirebase()
var removeCompanyFromFirebase = function(ref) {
  // beaconEventRef can be passed in as DataSnapshot
  var fb = new Firebase(ref.toString());
  fb.remove();
  console.info('[Reset] Firebase Removed:',ref);
}

var configureDEBUG = function() {
  var debugConfig = Meteor.settings.DEBUG;
  if (debugConfig && JSON.stringify(debugConfig) != "{}") {
    console.info("[Dev] Applying DEBUG options: ", debugConfig);
    if (debugConfig.resetLocal) {
      resetLocal();
    }
  }

  Debug.observeChanges();
}

var resetLocal = function() {
  var collections = [BeaconEvents, Encounters, Visitors, Metrics, Funnels];
  collections.forEach(function(collection) {
    collection.remove({});
    console.info("[Reset] Removed all data in:", collection._name);
  });
}