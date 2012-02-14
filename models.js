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
            },
            trim: true
        },
        'description': {
            type: String
        },
        'resource': {
            type: { name: String, file: String, size: Number, tmp: String, thumbnail: String, mime: String },
            set: function(v) {
// A commenter pour import de docatl
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
// Fin commentaire import docatl

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
        'statistics': [Date],
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

    // virtual path getter and setter
    Document_Schema
    .virtual('path')
    .get(function() {
        var path = "";
        this.tags.some(function(tag) {
            if (tag.charAt(0) === '/') {
                path = tag;
                return true;
            }
        });
        return path;
    })
    .set(function(path) {
        var tags = this.tags;
        tags.splice(tags.indexOf(this.path), 1, path);
        this.set('tags', tags);
    });

    // Virtual download
    Document_Schema
    .virtual('addDownload')
    .set(function() {
        var stat = this.statistics;
        stat.push(new Date());
        this.set('statistics', stat);
        this.save();
        // For chaining
        return this;
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
            index = index.concat(_this[indexable] ? (_.isArray(_this[indexable]) ? _this[indexable] : _this[indexable].split(' ')) : [])
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
    };

    Document_Schema.methods.update = function(values, callback) {
        var _this = this;
        _.each(values, function(value, path) {
            if (Document_Schema.path(path) || Document_Schema.virtualpath(path)) _this.set(path, value);
        });
        this.save(callback);
    };


    // thumbnail maker with imagemagick
    Document_Schema.methods.createThumbnail = function(resource, callback) {
        var doc = this
          , options = nconf.get('thumbnails:options')
          , srcPath = null
          , dstPath = null;
        
        // Si resource n'est une fonction c'est une création
        if (typeof resource === 'function') {
            callback = resource;
            resource = this.resource;
            srcPath = nconf.get('documents:dirs:files') + resource.file;
        }
        // Sinon c'est une maj
        else {
            resource.file = resource.path;
            srcPath = resource.path;
            dstPath = resource.path + '.png';
        }
        
        if (nconf.get('thumbnails:thumbables').indexOf(resource.mime) !== -1) {
            var filename = resource.file.split('/').pop();
            im.resize(_.extend(options, {
                srcPath: srcPath + '[0]', // [0] first page pdf conversion
                dstPath: dstPath || nconf.get('documents:dirs:tmp') + '/' + filename + '.png'
            }), function(err) {
                if (err) {
                    doc.set('resource.thumbnail', '');
                    callback(err);
                } else {  // move generated thumbnail
                    var pathfile = nconf.get('documents:dirs:thumbs') + '/' + filename.substr(0, 2);
                    path.exists(pathfile, function(exist) {
                        if (!exist) fs.mkdirSync(pathfile, 0755);
                        fs.rename(nconf.get('documents:dirs:tmp') + '/' + filename + '.png', pathfile + '/' + filename + '.png', function(err) {
                            if (err) callback(err);
                            else {
                                doc.set('resource.thumbnail', '/' + filename.substr(0, 2) + '/' + filename + '.png');
                                callback(null);
                            }
                        });
                    });
                }
            });
        } else {
            doc.set('resource.thumbnail', '');
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

        // search : impossible de le mettre dans le each ci-dessous, pas de helper $and
        if (search_query = req.search) {
            // initilisation $and if needed (no tags)
            if (!query.$and) query.$and = [];
            var words = search_query.split(' ');
            words.forEach(function(word){
                word = word.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
                query.$and.push({"_keywords": new RegExp(word, 'i')});
            });
        }

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
    
    /**
     * Collections' declaration
     */

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
