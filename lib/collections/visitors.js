Visitors = new Meteor.Collection('visitors', {
  transform: function (doc) {
    // TODO refactor constructor to load from doc
    var obj = new Visitor(doc.uuid);
    _.extend(obj, doc);
    return obj;
  }
});

Visitor = function(uuid) {
  this.uuid = uuid;
}

Visitor.prototype.save = function() {
  var selector = {
    uuid: this.uuid
  };
  var modifier = {
    $set: {
    }
  };
  var result = Visitors.upsert(selector, modifier);
  if (result.insertedId) {
    this._id = result.insertedId;
  } else {
    this._id = Visitors.findOne(selector)._id;
  }
  return this._id;
}

// Given the time range specified by the metric,
// trace all the encounters by this visitor
Visitor.prototype.subPaths = function(metric) {
  var self = this;
  var encounters = Encounters.find({visitorId: self._id,
                                    enteredAt: {$gte: metric.enteredAt},
                                    exitedAt: {$lte: metric.exitedAt}},
                                   {sort: {enteredAt: 1}});
  var visit = new Visit(encounters);
  return visit.subPaths();
}

Visitor.ensureIndex = function() {
  Visitors._ensureIndex({uuid: 1});
}