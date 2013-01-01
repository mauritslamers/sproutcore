// ==========================================================================
// Project:   SproutCore - JavaScript Application Framework
// Copyright: ©2010 Evin Grano
// License:   Licensed under MIT license (see license.js)
// ==========================================================================

/**
  @class

  A ChildArray is used to map an array of ChildRecord
  
  @extends SC.Enumerable
  @extends SC.Array
  @since SproutCore 1.0
*/

SC.ChildArray = SC.Object.extend(SC.Enumerable, SC.Array,
  /** @scope SC.ManyArray.prototype */ {
  
  
  isChildArray: true, // walk like a duck...
    
  /**
    If set, it is the default record recordType
  
    @property {SC.Record}
  */
  defaultRecordType: null,
  
  /**
    If set, the parent record will be notified whenever the array changes so that 
    it can change its own state
    
    @property {SC.Record}
  */
  parentObject: null,
  
  /**
    If set will be used by the many array to get an editable version of the
    storeIds from the owner.
    
    @property {String}
  */
  parentAttribute: null,
  
  /**
    Actual references to the hashes
  */
  children: null,
  
  /**
    The store that owns this record array.  All record arrays must have a 
    store to function properly.

    @property {SC.Store}
  */
  store: function() {
    return this.getPath('record.store');
  }.property('parentObject').cacheable(),
  
  /**
    The storeKey for the parent record of this many array.  Editing this 
    array will place the parent record into a READY_DIRTY state.

    @property {Number}
  */
  storeKey: function() {
    return this.getPath('parentObject.storeKey');
  }.property('parentObject').cacheable(),
  
  isDestroyed: function(key, value) {
    var parent = this.get('parentObject');
    if(value !== undefined){
      this._sc_nestedrec_isDestroyed = value; // setting for destroyed nested records
    }
    else if(this._sc_nestedrec_isDestroyed){
      return true;
    }
    else return !!(parent.get('status') & SC.Record.DESTROYED);
  }.property('status').cacheable(),
  
  // destroy: function(){
  //   var d = function(obj){
  //     if(obj && obj.destroy) obj.destroy();
  //   };
  //   this.forEach(d);
  //   this.set('isDestroyed',true);
  //   this.set('parentObject',null); // prevent memory leak
  //   this.set('parentAttribute',null);
  // },
  
  notifyChildren: function(prop){
    var d = function(obj){
      if(obj){
        if(obj.notifyPropertyChange){
          obj.notifyPropertyChange(prop);
        }
        if(obj.notifyChildren){
          obj.notifyChildren(prop);
        }
      }
    };
    
    this.forEach(d);
  },
  
  /**
    Returns the storeIds in read only mode.  Avoids modifying the record 
    unnecessarily.
    
    @property {SC.Array}
  */
  readOnlyChildren: function() {
    //return this.get('parentObject').readAttribute(this.get('propertyName'));
    return this.get('parentObject').readAttribute(this.get('parentAttribute'));
  }.property(),
  
  /**
    Returns an editable array of child hashes.  Marks the owner records as 
    modified. 
    
    @property {SC.Array}
  */
  editableChildren: function() {
    var parent = this.get('parentObject'),
        parentAttr = this.get('parentAttribute'),
        ret;
        
    ret = parent.readEditableAttribute(parentAttr);
    if(!ret){
      ret = [];
    }
    if(ret !== this._prevChildren) this.recordPropertyDidChange();
    
    return ret;
    // 
    // if(parent){
    //   
    // }
    // else {
    //   store = this.get('store');
    //   storeKey = this.get('storeKey');
    //   ret = store.readEditableProperty(storeKey)
    // }
    // 
    // var store    = this.get('store'),
    //     storeKey = this.get('storeKey'),
    //     pname    = this.get('parentAttribute'),
    //     ret, hash;
    //     
    // ret = store.readEditableProperty(storeKey, pname);    
    // if (!ret) {
    //   hash = store.readEditableDataHash(storeKey);
    //   ret = hash[pname] = [];      
    // }
    // 
    // if (ret !== this._prevChildren) this.recordPropertyDidChange();
    // return ret ;
  }.property(),
    
  // convenience method  
  createNestedRecord: function(recType,hash){
    var parent = this.get('parentObject'),
        pattr  = this.get('parentAttribute'),
        rec;
    
    rec = parent.createNestedRecord(recType,hash,pattr);
    return rec;
  }, 
  
  readAttribute: function(key){
    var parent = this.get('parentObject');
    if(!parent) throw new Error("ChildArray without a parentObject? this is a bug");
    return parent.readAttribute(key);
  },
  
  _writeAttribute: function(keyStack, value, ignoreDidChange) {
    var parent = this.get('parentObject');
    if(!parent) throw new Error("ChildArray without a parent? this is a bug");
    return parent._writeAttribute(keyStack, value, ignoreDidChange);
  },
  
  recordDidChange: function(key){
    var parent = this.get('parentObject');
    if(!parent) throw new Error("ChildArray without a parent? this is a bug");
    return parent.recordDidChange(key);    
  },
  
  attributes: function(){
    var parent = this.get('parentObject'), 
        parentAttr = this.get('parentAttribute'), 
        attrs;
    
    if(!parent) throw new Error("ChildArray without a parent? this is a bug");
    attrs = parent.get('attributes');
    if(attrs) return attrs[parentAttr];
    else return attrs;
  }.property(),
  
  status: function(){
    var parent = this.get('parentObject');
    if(parent) return parent.get('status');
  }.property(),
  // ..........................................................
  // ARRAY PRIMITIVES
  // 

  /** @private
    Returned length is a pass-through to the storeIds array.
    
    @property {Number}
  */
  length: function() {
    var children = this.get('readOnlyChildren');
    return children ? children.length : 0;
  }.property('readOnlyChildren'),

  /** @private
    Looks up the store id in the store ids array and materializes a
    records.
  */
  
  objectAt: function(idx) {
    var recs      = this._records, 
        children = this.get('readOnlyChildren'),
        hash, ret, pname = this.get('parentAttribute'),
        parent = this.get('parentObject');
    var len = children ? children.length : 0;
    
    if (!children) return undefined; // nothing to do
    if (recs && (ret=recs[idx])) return ret ; // cached
    if (!recs) this._records = recs = [] ; // create cache
    
    // If not a good index return undefined
    if (idx >= len) return undefined;
    hash = children.objectAt(idx);
    if (!hash) return undefined;
    
    // not in cache, materialize
    //recs[idx] = ret = parent.registerNestedRecord(hash, pname);
    recs[idx] = ret = parent.materializeNestedRecord(hash, pname, this);
    
    return ret;
  }, 

  /** @private
    Pass through to the underlying array.  The passed in objects must be
    records, which can be converted to storeIds.
  */
  replace: function(idx, amt, recs) {
    var children = this.get('editableChildren'), 
        len      = recs ? (recs.get ? recs.get('length') : recs.length) : 0,
        record   = this.get('parentObject'), newRecs,
        
        pname    = this.get('parentAttribute'),
        cr, recordType;
    
    newRecs = this._processRecordsToHashes(recs);
    children.replace(idx, amt, newRecs);
    
    // remove item from _records cache, to leave them to be materialized the next time
    this._records.replace(idx,amt); 
    record.writeAttribute(pname,children);
    // notify that the record did change...
    record.recordDidChange(pname);
    this.enumerableContentDidChange();
    return this;
    
  },
  
  _processRecordsToHashes: function(recs){
    var store, sk;
    recs = recs || [];
    recs.forEach( function(me, idx){
      if (me.isNestedRecord){
        store = me.get('store');
        sk = me.storeKey;
        recs[idx] = store.readDataHash(sk);
      }
    });
    
    return recs;
  },
  
  /*
  calls normalize on each object in the array
  */
  normalize: function(){
    this.forEach(function(child,id){
      if(child.normalize) child.normalize();
    });
  },
  
  // ..........................................................
  // INTERNAL SUPPORT
  //  
  
  /** @private 
    Invoked whenever the children array changes.  Observes changes.
    
    WARNING: THIS FUNCTION CREATES OBSERVERS IN THE STORE (!)
  */
  
  recordPropertyDidChange: function(keys){
    console.log('recordPropertyDidChange called');
    return this;
  },
  // recordPropertyDidChange: function(keys) {
  //   if (keys && !keys.contains(this.get('parentAttribute'))) return this;
  //   
  //   var children = this.get('readOnlyChildren');
  //   var prev = this._prevChildren, f = this._childrenContentDidChange;
  //   
  //   if (children === prev) return this; // nothing to do
  //       
  //   if (prev) prev.removeObserver('[]', this, f);
  //   this._prevChildren = children;
  //   if (children) children.addObserver('[]', this, f);
  //   
  //   var rev = (children) ? children.propertyRevision : -1 ;
  //   this._childrenContentDidChange(children, '[]', children, rev);
  //   return this;
  // },

  /** @private
    Invoked whenever the content of the children array changes.  This will
    dump any cached record lookup and then notify that the enumerable content
    has changed.
  */
  _childrenContentDidChange: function(target, key, value, rev) {
    this._records = null ; // clear cache
    this.enumerableContentDidChange();
  },
  
  /** @private */
  init: function() {
    sc_super();
    this.recordPropertyDidChange();
  }
  
}) ;