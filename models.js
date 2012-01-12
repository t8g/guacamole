var fs = require('fs')
    , path = require('path')
    , mime = require('mime')
    , im = require('imagemagick')
    , _ = require('underscore')
    , nconf = require('nconf')
    , extrafields = require('./extrafields')
    ;


/**
 * Configuration
 */
nconf.file({ file: './conf.json' });

function define(mongoose, fn) {

    /*
     * Vars
     */

    var Schema = mongoose.Schema,
        ObjectId = Schema.ObjectId;

    /*
     * Schemas : Document
     */

    Document_Schema = new Schema({
        'slug': {
            type: String, index: { unique: true },
            set: function(v) {
                return slugify(v);
            }
        },
        'title': {
            type: String,
            set: function(v) {
                if (v == '') v = this.title;
                if (!this.slug) this.slug = v;
                return v;
            }
        },
        'description': String,
        'resource': {
            type: { name: String, file: String, size: Number },
            set: function(v) {

                // update file
                if (v.tmp && !v.file) {
                    var filename = v.tmp.split('/').pop();
                    var pathfile = nconf.get('documents:dirs:files') + '/' + filename.substr(0, 2);

                    path.exists(pathfile, function(exist) {
                        if (!exist) fs.mkdirSync(pathfile, 0755);
                        fs.rename(v.tmp, pathfile + '/' + filename, function(err) {
                            //if (err) // how to do Something ???
                            //remove resource.tmp from document ?
                        });
                    });

                    v.size = fs.statSync(v.tmp).size;
                    v.thumbnail = null;
                    v.mime = mime.lookup(v.tmp);
                    v.file = '/' + filename.substr(0, 2) + '/' + filename;
                    //v.path = '/' + filename.substr(0, 2) + '/';
                }

                // default title
                if (!this.title) this.title = v.name;

                return v;
            }
        },
        'tags': {
            type: [String],
            set: function(v) {
                var tags = v;
                if (v.length == 1) tags = _.invoke(v[0].split(','), function() { return tagify(this); });
                tags = _.uniq(tags);
                // Save new tags
                tags.forEach(function(tag_label) {
                    if(tag_label.trim()) {
                        Tag.findOne({ label: tag_label }, function(err, tag) {
                            if (!tag) {
                                tag = new Tag({label: tag_label});
                                tag.save();
                            }
                        });
                    }
                });

                return tags;
            }
        },
        'status': Number, // 0 or undefined = exist, 1 = deleted
        'created_at': {
            type: Date,
            default: Date.now,
            set: function(v) {
                if (!this.created_at) return Date.now();
                return this.created_at;
            }
        },
        'updated_at': {
            type: Date,
            default: Date.now
        },
        '_keywords': [String]
    })
    .pre('save', function(next) { // A tester
        if (!this.created_at) {
            this.created_at = this.updated_at = new Date;
        } else {
            this.updated_at = new Date;
        }
        // indexation
        this._keywords = this.index();
        next();
    })
    .pre('remove', function(next) {
        // delete all resources
        // Le probleme c'est que Model.remove() ne fait pas appel à ça
    });

    // virtual thumbnail getter and setter
    Document_Schema
    .virtual('thumbnail')
    .get(function() {
        return this.resource.thumbnail || this.resource.mime || mime.lookup(this.resource.file);
    })
    .set(function(v) {
        // si not false, essaye d'utiliser v comme source si image si existe avec éventuellement retaille + renommage idem file
        // sinon passe à null (retour fonc sur mime)
    });

    // Extra fields (from extrafields.js file)
    Document_Schema.add(extrafields);

    // Indexation
    Document_Schema.methods.index = function() {
        var indexables = nconf.get('documents:index')
            , index = []
            , _this = this
            ;

        indexables.forEach(function(indexable) {
            index = index.concat((_this[indexable]) ? _this[indexable].split(' ') : []);
        });

        return index;
    };

    // toJSON with getters
    // https://gist.github.com/1584121
    // https://github.com/LearnBoost/mongoose/issues/412
    Document_Schema.methods.toJSON2 = function() {
      var json = this.toJSON()
          , _this = this
          ;

        Document_Schema.eachPath(function(path) {
            json[path] = _this.get(path);
        });
        return json;
    }


    // thumbnail maker with imagemagick
    Document_Schema.methods.createThumbnail = function(callback) {
        var options = nconf.get('thumbnails:options');

        if (nconf.get('thumbnails:thumbables').indexOf(this.resource.mime) !== -1) {
            var _this = this;
            var filename = this.resource.file.split('/').pop();
            im.resize(_.extend(options, {
                srcPath: nconf.get('documents:dirs:files') + this.resource.file + '[0]', // [0] first page pdf conversion
                dstPath: nconf.get('documents:dirs:tmp') + '/' + filename + '.png'
            }), function(err) {
                if (err) {
                    _this.resource.thumbnail = '';
                    callback(null);
                    //callback(err);
                } else {  // move generated thumbnail
                    var pathfile = nconf.get('documents:dirs:thumbs') + '/' + filename.substr(0, 2);
                    path.exists(pathfile, function(exist) {
                        if (!exist) fs.mkdirSync(pathfile, 0755);
                        fs.rename(nconf.get('documents:dirs:tmp') + '/' + filename + '.png', pathfile + '/' + filename + '.png', function(err) {
                            if (err) callback(err);
                            else {
                                _this.resource.thumbnail = _this.resource.file + '.png';
                                callback(null);
                            }
                        });
                    });
                }
            });
        } else {
            this.resource.thumbnail = '';
            callback(null);
        }
    };

    Document_Schema.statics.getSome = function(req, callback) {
        var query = {}
            ,blackhole = nconf.get('documents:blackhole')
            ,tags
            ,_this
            ;

        // tags : impossible de le mettre dans le each ci-dessous, pas de helper $and
        if (tags = req.tags) {
            tags = _.isArray(tags) ? tags : tags.split(',');
            tags = _.map(tags, function(tag) {
                if (tag === blackhole) return { $or: [
                    { tags: blackhole },
                    { tags: { $not: /^\//g } }
                ]};
                if (typeof tag === 'object') return tag;
                else return {tags:tag};
            });
            query = { $and: tags };
        };
        _this = this.find(query);

        _.each(req ,function(value, key) {

            // Filtres
            if (filter = _.find(nconf.get('documents:filters'), function(v, k) { return k == key; })) {

                // Tranforme valeur si Number
                // @TODO regarder eachPath sur http://mongoosejs.com/docs/api.html
                var path = Document_Schema.path(key);
                if (!(type = (path ? path.instance : false))) {
                    var subpaths = key.split('.');
                    var type = Document_Schema.path(subpaths[0]).options.type[subpaths[1]] || 'String';
                    type = (type == Number) ? 'Number' : 'String';
                }
                if (type == 'Number') value = parseFloat(value);

                if (filter == 'exact') _this.where(key, value);
                if (filter == 'like') _this.regex(key, new RegExp(value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"), 'i'));
            }

            if (key == 'search') {
                var values = value.split(' ');
                values.forEach(function(value){
                    value = value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
                    _this.regex('_keywords', new RegExp(value, 'i'));
                });
            }

        });

        // LISTE et QUERY
        // limit, offset, sort, search
        return _this.run(callback);

    };

    // @TODO : A mettre dans une lib
    var slugify = function(s) {
        return s.replace(/\s+/ig, '_').replace(/[^a-zA-Z0-9_]+/ig, '').toLowerCase(); // TODO garder les accents (à trans en non accent)
    };

    // @TODO : A mettre dans une lib
    var tagify = function(s) {
        // caractères interdits : &,
        return s.replace(/([&,])+/ig, '').trim();
    };

    /*
     * Schemas : Tag
     */

    Tag_Schema = new Schema({
        'label': { type: String, index: { unique: true }, set: function(v) {
            return tagify(v);
        }}
    });

    Tag_Schema.statics.getSome = function(req, callback) {
        var query = {}
            ,subdirsof
            ;

        // Récupération des /tags fils direct d'un /tag
        if (subdirsof = req.subdirsof) {
            subdirsof = subdirsof.replace(new RegExp('/+$', 'g'), '');
            var deep = subdirsof.split('/').length + 1;
            query = { $and: [
                { label: new RegExp('^' + subdirsof + '/', 'i') },
                { $where: "this.label.split('/').length === " + deep }
            ]};
            if (subdirsof === '') query.$and.push({ label: { $ne: '/' } });
        }

        if (startwith = req.startwith) {
            if (startwith[0] === '/' && req.slash && req.slash === 'false') return [];
            query = { label: new RegExp('^' + startwith, 'i') };
        }

        return this.find(query).sort('label', 'ascending').execFind(callback);

    };

    var Document = mongoose.model('Document', Document_Schema);

    /*
     * Document.prototype.save - redefinition
     */

    Document.prototype._save = Document.prototype.save;
    Document.prototype.save = function(fn) {
        var self = this;
        self._save(function(err) {
            if (!err) {
                if (fn) fn(err);
            } else if (err.message.indexOf('E11000') == 0) { // Sans doute prévoir un meilleur test (quid si autre champ unique ?)
                // calcul du nouveau slug
                var slug = self.slug.split('-');
                var i = (slug.length > 1) ? slug.pop() : 0;
                self.setValue('slug', slug.join('-') + '-' + (i*1+1));
                self.isNew = true;
                self.save(fn);
            } else {
                //throw new Error(err.message)
                fn(err);
            }
        });
    };

    var Tag = mongoose.model('Tag', Tag_Schema);

    // Launch callback
    fn();

};

exports.define = define;
