var fs = require('fs')
    ,path = require('path')
    ,mime = require('mime')
    ,im = require('imagemagick')
    ,_ = require('underscore')
    ;

function define(mongoose, fn){

    /*
     * Vars
     */

    var Schema = mongoose.Schema,
        ObjectId = Schema.ObjectId;

    /*
     * Schemas : Document
     */

    Document_Schema = new Schema({
        'slug': { type: String, index: { unique: true }, set: function(v){
            return slugify(v);
        }},
        'title': { type: String, set: function(v){
            if (v == '') v = this.title;
            if (!this.slug) this.slug = v;
            return v;
        }},
        'description': String,
        'resource': { type: { name: String, file: String }, set: function(v){

            // update file
            if (v.tmp && !v.file){
                var filename = v.tmp.split('/').pop();
                var pathfile = Document.documents_dir.files + '/' + filename.substr(0, 2);

                path.exists(pathfile, function(exist){
                    if (!exist) fs.mkdirSync(pathfile, 0755);
                    fs.rename(v.tmp, pathfile + '/' + filename, function(err){
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
        }},
        'tags': { type: [String], set: function(v){
            var tags = v;
            if (v.length == 1) tags = _.invoke(v[0].split(','), function() { return tagify(this); });
            tags = _.uniq(tags);
            // Save new tags
            tags.forEach(function(tag_label){
                if(tag_label.trim()){
                    Tag.findOne({ label: tag_label }, function(err, tag){
                        if (!tag){
                            tag = new Tag({label: tag_label});
                            tag.save();
                        }
                    });
                }
            });

            return tags;
        }},
        'status': Number, // 0 or undefined = exist, 1 = deleted
        'created_at': { type: Date, default: Date.now, set: function(v){
            if (!this.created_at) return Date.now();
            return this.created_at;
        }},
        'updated_at': { type: Date, default: Date.now }
    })
    .pre('save', function (next){ // A tester
        if (!this.created_at){
            this.created_at = this.updated_at = new Date;
        } else {
            this.updated_at = new Date;
        }
        next();
    });

    // virtual thumbnail getter and setter
    Document_Schema
    .virtual('thumbnail')
    .get(function(){
        return this.resource.thumbnail || this.resource.mime || mime.lookup(this.resource.file);
    })
    .set(function(v){
        // si not false, essaye d'utiliser v comme source si image si existe avec éventuellement retaille + renommage idem file
        // sinon passe à null (retour fonc sur mime)
    });

    // thumbnail maker with imagemagick
    Document_Schema.methods.createThumbnail = function createThumbnail(options, callback){
        // @TODO place this in settings file
        if (['image/jpeg', 'image/png', 'application/pdf'].indexOf(this.resource.mime) !== -1){
            var _this = this;
            var filename = this.resource.file.split('/').pop();
            im.resize(_.extend(options, {
                srcPath: Document.documents_dir.files + this.resource.file + '[0]', // [0] first page pdf conversion
                dstPath: Document.documents_dir.tmp + '/' + filename + '.png'
            }), function(err){
                if (err) callback(err);
                else {  // move generated thumbnail
                    var pathfile = Document.documents_dir.thumbs + '/' + filename.substr(0, 2);
                    path.exists(pathfile, function(exist){
                        if (!exist) fs.mkdirSync(pathfile, 0755);
                        fs.rename(Document.documents_dir.tmp + '/' + filename + '.png', pathfile + '/' + filename + '.png', function(err){
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
            // thumbnail par défaut (selon mime)
            this.resource.thumbnail = 'default icon selon mime : ' + this.resource.mime;
            callback(null);
        }
    };

    // @TODO : A mettre dans une lib
    var slugify = function(s){
        return s.replace(/\s+/ig, '_').replace(/[^a-zA-Z0-9_]+/ig, '').toLowerCase(); // TODO garder les accents (à trans en non accent)
    };

    // @TODO : A mettre dans une lib
    var tagify = function(s){
        // caractères interdits : &,
        return s.replace(/([&,])+/ig, '').trim();
    };

    /*
     * Schemas : Tag
     */

    Tag_Schema = new Schema({
        'label': { type: String, index: { unique: true }, set: function(v){
            return tagify(v);
        }}
    });

    var Document = mongoose.model('Document', Document_Schema);

    /*
     * Document.prototype.save - redefinition
     */

    Document.prototype._save = Document.prototype.save;
    Document.prototype.save = function(fn){
        var self = this;
        self._save(function(err){
            if (!err) fn(err);
            else if (err.message.indexOf('E11000') == 0){ // Sans doute prévoir un meilleur test (quid si autre champ unique ?)
                // calcul du nouveau slug
                var slug = self.slug.split('-');
                var i = (slug.length > 1) ? slug.pop() : 0;
                self.setValue('slug', slug.join('-') + '-' + (i*1+1));
                self.isNew = true;
                self.save(fn);
            } else {
                throw new Error(err.message)
            }
        });
    };

    var Tag = mongoose.model('Tag', Tag_Schema);

    // Launch callback
    fn();

};

exports.define = define;
