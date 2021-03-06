/**
 * Guacamole.js
 * Copyright (c) 2011 Toog <contact@toog.fr>
 * MIT Licensed
 */

/**
 * Module dependencies
 */

// var cluster = require('cluster')
//     , http = require('http')
//     , numCPUs = require('os').cpus().length
//     ;

// if (cluster.isMaster) {
//     // Fork workers.
//     for (var i = 0; i < numCPUs; i++) {
//         cluster.fork();
//     }

//     cluster.on('death', function(worker) {
//         console.log('worker ' + worker.pid + ' died');
//     });
// } else {

var express = require('express')
    , mongoose = require('mongoose')
    , models = require(__dirname + '/models')
    , _ = require('underscore')
    , fs = require('fs')
    , nconf = require('nconf')
    , tools = require(__dirname + '/tools')
    , async = require('async')
    , zip = require('node-native-zip')
    , argv = require('optimist').argv
    , less = require('less')
    , passport = require('passport')
    , LocalStrategy = require('passport-local').Strategy
    ;

/**
 * Configuration
 */

nconf.file({ file: __dirname + '/conf.json' });

/**
 * Vars
 */

var db, Document, Tag;

/**
 * Static Resources
 */
var public_resources = [];
tools.readDir(__dirname + '/public', function(err, files) {
    public_resources = files;
});


/**
 * Server instance
 */

var app = module.exports = express.createServer();

/**
 * Enable minification for less files
 */

express.compiler.compilers.less.compile = function (str, fn) {
    try {
        less.render(str, { compress : true }, fn);
    } catch (err) {
        fn(err);
    }
};

/**
 * Server configuration
 */

app.configure(function() {
    app.set('views', __dirname + '/views');
    // custom html template
    app.register('.html', {
        compile: function(str, options) {
            return function(locals) {
                return str;
            };
        }
    });
    app.use(express.compiler({ src: __dirname + '/public', enable: ['less'] }));
    app.use(express.cookieParser());
    app.use(express.bodyParser({ keepExtensions: true, uploadDir: nconf.get('documents:dirs:tmp') }));
    app.use(express.methodOverride());
    app.use(express.session({ secret: 'keyboard cat' }));
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(app.router);
    app.use(express.static(__dirname + '/public'));
});

/**
 * Environment configuration
 */

app.configure('development', function() {
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function() {
    app.use(express.errorHandler());
});

/**
 * Model definition, using mongoose
 *
 * @param {Object} longoose
 * @param {Function} callback
 */

models.define(mongoose, function() {
    app.Document = Document = mongoose.model('Document');
    app.Tag = Tag = mongoose.model('Tag');
    app.User = User = mongoose.model('User');
    db = mongoose.connect(nconf.get('mongo:connection'));
});

/**
 * Error handler
 * log errors & send a (503 by default) status code with error message
 *
 * @param {ServerResponse} response
 * @param {Mixed} error
 * @param {Integer} HTTP status code
 * @return {ServerResponse}
 */

var handleError = function(res, err, status) {
    status = status || 503; // Service Unavailable
    err = err || status;
    console.log({'status': status, 'error': err});
    return res.send(status, {error: err});
}

/**
 * DOCUMENT Routes :
 */

/**
 * GET documents
 *
 * @param {Object} request
 * @param {Object} response
 * @return {Json} documents list
 * @api public
 */

app.get('/documents', function(req, res) {
    Document.getSome(req.query, function(err, docs) {

        // si pas de /tag, on ajoute le blackhole (pour filtre côté client)
        docs = docs.map(function(doc) {
            var tags = doc.tags;
            if (_.isEmpty(_.filter(tags, function(tag) { return tag.match(/^\//g); }))) {
                tags.push(nconf.get('documents:blackhole'))
                doc.tags = tags;
            }
            return doc;
        });

        res.respond(err || docs, err ? 500 : 200);
    });
});

/**
 * GET documents/:id
 *
 * @param {Object} request
 * @param {Object} response
 * @return {Json} one document matching the id parameter
 * @api public
 */

app.get('/documents/:id', function(req, res) {
    Document.findById(req.params.id, function(err, doc) {
        res.respond(err || doc.toJSON2(), err ? 500 : ( doc ? 200 : 404 ));
    });
});

/**
 * POST document, CREATE a document
 *
 * @param {Object} request
 * @param {Object} response
 * @return {Json} the saved document
 * @api public
 */

app.post('/documents', function(req, res) {
    // pour tester
    //curl --silent -F resource=@test.pdf http://localhost:3000/documents -F tags=/bla | json
    if (req.files.resource) {

        // create document with temp file and resource info
        var doc = new Document(_.extend(req.body, { resource: {
            name: req.files.resource.filename,
            tmp: req.files.resource.path,
        }}));

        // create thumbnail and save
        doc.createThumbnail(function(err) {
            err ? res.respond(err, 500) : doc.save(function(err) { res.respond(err || doc, err ? 500 : 200); });
        });

    } else {
        res.respond('No files resources found', 500);
    }

});

/**
 * DELETE document
 *
 * @param {Object} request
 * @param {Object} response
 */

app.del('/documents/:id', function(req, res) {
    Document.remove({ _id: req.params.id }, function(err) {
        res.respond(err || {}, err ? 500 : 200);
    });
});

/**
 * PUT documents (update)
 */

app.put('/documents/:id', function(req, res) {
    Document.findById(req.params.id, function(err, doc) {
        if (err) return res.respond(err, 500);

        if (req.files && req.files.resource) {
            console.log('ici');
            if (req.body.new_preview) {
                console.log('Créer un nouvel aperçu');
            }
            res.respond(doc, 200);
        } else {
            doc.update(req.body, function(err) {
                res.respond(err || doc, err ? 500 : 200);
            });
        }

    });

});

/**
 * PUT documents thumbnail (update thumbnail)
 */

app.put('/documents/:id/thumbnail', function(req, res) {
    Document.findById(req.params.id, function(err, doc) {
        // Edit thumbnail and save
        doc.createThumbnail(req.files.resource, function(err) {
            err ? res.respond(err, 500) : doc.save(function(err) { res.respond(err || doc, err ? 500 : 200); });
        });
    });
});

/**
 * Mass move of documents
 *
 * @param {Object} request
 * @param {Object} response
 * @return {Json} status
 * @api public
 */

app.post('/documents/batch/move', function(req, res) {
    Document.find({ _id: { $in : req.body.ids } }, function(err, docs) {
        if (err) return res.respond(err, 500);
        var path = req.body.path || '/';
        
        async.forEach(docs,
            function(doc, fn) {
                doc.update({ path: path }, fn);
            },
            function(err) {
                return res.respond(err || {}, err ? 500 : 200);
            }
        );
    });
});

/**
 * Mass deletion of documents
 *
 * @param {Object} request
 * @param {Object} response
 * @return {Json} status
 * @api public
 */

app.post('/documents/batch/delete', function(req, res) {
    Document.remove({ _id: { $in : req.body.ids } }, function(err) {
        res.respond(err || {}, err ? 500 : 200);
    });
});


/**
 * Mass download of documents
 *
 * @param {Object} request
 * @param {Object} response
 * @return {Json} status
 * @api public
 */
//@TODO : statistiques aussi
app.post('/documents/batch/download', function(req, res, next) {
    Document.find({ _id: { $in : req.body.ids } }, function(err, docs) {
        if (err) return res.respond(err, 500);
        var zipfile = new zip();
        zipfile.addFiles(
            docs.map(function(doc) {
                return {
                    name: doc.resource.name,
                    path: nconf.get('documents:dirs:files') + doc.resource.file
                }
            }),
            function () {
                var buff = zipfile.toBuffer();
                var zipfilename = new Date().getTime() + '.zip';
                fs.writeFile(nconf.get('documents:dirs:tmp') + '/' + zipfilename , buff, function () {
                    res.respond({ 'zipfile': zipfilename }, 200);
                });
            },
            function (err) {
                res.respond(err, 500);
            }
        );
    });
});

app.get('/documents/batch/download/:zipfile', function(req, res, next) {
       tools.serve(
        nconf.get('documents:dirs:tmp') + '/' + req.params.zipfile,
        [
            {name: 'Date', value: new Date().toUTCString()},
            //{name: 'Last-Modified', value: stat.mtime.toUTCString()},
            {name: 'Content-Type', value: 'application/zip'},
            {name: 'Content-Disposition: attachment; filename="'+req.params.zipfile+'"'}
        ],
        req,
        res,
        next
    );
    // supprimer le zip une fois télécharger ou régulièrement ?
});

/**
 * Mass update of documents tags
 *
 * @param {Object} request
 * @param {Object} response
 * @return {Json} status
 * @api public
 */

app.post('/documents/batch/tags', function(req, res) {

    Document.find({ _id: { $in : req.body.ids } }, function(err, docs) {
        if (err) return res.respond(err, 500);

        async.forEach(
            docs,
            function(doc, fn) {
                var tags = doc.tags;
                if (req.body.todelete) tags = _.difference(tags, req.body.todelete);
                if (req.body.toadd) tags = _.union(tags, req.body.toadd);
                doc.tags = tags;
                doc.save(fn);
            },
            function(err) {
                return res.respond(err || {}, err ? 500 : 200);
            }
        );
    });

});

/* TODO :
 * Ajouter les actions suivantes :
 *   - modification de masse (sur selection de documents) : sur liste
 *   - suppression masse : sur liste
 *  - update thumb : forcer recalcul de la thumbnail
 */

/**
 * THUMBNAILS Routes :
 */

app.get('/documents/:id/thumbnail', function(req, res, next) {

    // @TODO : vérif droits

    Document.findById(req.params.id, function(err, doc) {
        if (err || _.isEmpty(doc)) res.respond('File Not Found', 404);

        // get generated thumbnail or default (mime dependent)
        var file = doc.resource.thumbnail
            ? nconf.get('documents:dirs:thumbs') + doc.resource.thumbnail
            : nconf.get('thumbnails:default-path') + (nconf.get('thumbnails:default')[doc.resource.mime] || nconf.get('thumbnails:default')['*'] || 'default.png');

        tools.serve(file, [ { name: 'Content-Type', value: 'image/' + nconf.get('thumbnails:options:format') } ], req, res, next );
    });

});

app.update('/documents/:id/thumbnail/', function(req, res) {
   res.send('toto');
});

/**
 * Download document :
 */

app.get('/documents/:id/file', function(req, res, next) {

    // @TODO : vérif droits

    Document.findById(req.params.id, function(err, doc) {
        if (err || _.isEmpty(doc)) res.respond('File Not Found', 404);
        // Add the cpt
        doc.set('addDownload')
        tools.serve(
            nconf.get('documents:dirs:files') + doc.resource.file,
            [
                {name: 'Date', value: new Date().toUTCString()},
                //{name: 'Last-Modified', value: stat.mtime.toUTCString()},
                {name: 'Content-Type', value: doc.resource.mime},
                {name: 'Content-Disposition: attachment; filename="'+doc.resource.name+'"'}
            ],
            req,
            res,
            next
        );
    });

});


/**
 * UPDATE thumbnail of document (id)
 */

// app.update('/thumbnail/:id', function(req, res) {

// }):



/**
 * TAGS Routes :
 */


/**
 * GET /tags : all tags
 */

app.get('/tags', function(req, res) {
    Tag.getSome(req.query, function(err, tags) {
        if (err) return handleError(res, err);
        res.send(tags);
    });
});

/**
 * POST tags (create)
 */

app.post('/tags', function(req, res) {
    var tag = new Tag(req.body);
    tag.save(function(err) {
        res.respond(err || tag, err ? 500 : 200);
    });
});

app.del('/tags/:id', function(req, res) {

    // TODO
    // Interdire si documents ou forcer ?
    res.writeHead(501, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'not implemented' }));

});



/**
 * USERS Routes :
 */

/**
 * Passport/user functions
 */
passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findOne(id, function (err, user) {
        done(err, user);
    });
});

passport.use(new LocalStrategy(
    function(username, password, done) {
        process.nextTick(function () {
            User.findOne({ email: username }, function (err, user) {
                if (err) return done(err);
                if (!user) {
                    return done(null, {
                        hasError: true
                      , field: 'username'
                      , message: 'Utilisateur inconnu'
                    });
                }
                if (!user.validPassword(password)) {
                    return done(null, {
                        hasError: true
                      , field: 'password'
                      , message: 'Mauvais mot de passe'
                    });
                }
                return done(null, user);
            });
        })
    }
));

// getUser middleware
var loadUser = function(req, res, next) {
    if (req.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

/**
 * GET login: connect the user
 */

app.get('/login', function(req, res, next) {
    if (req.user) {
        res.redirect('home');
    } else {
        res.render('login.html', { layout: false });
    }
});

/**
 * POST login: connect the user
 */

app.post('/login', function(req, res, next) {
    passport.authenticate('local', function(err, user) {
        if (err) return next(err);
        if (user.hasError) {
            return res.send(user);
        } else {
            req.logIn(user, function(err) {
                if (err) throw err;
                return req.body.haveToRedirect ?
                    res.redirect('home') :
                    res.send(user.getPublic);
            });
        }
    })(req, res, next);
});

/**
 * POST logout: deconnect the user
 */

app.get('/logout', function(req, res, next) {
    req.logOut();
    res.redirect('/login');
});


/**
 * GET getUser: get the current user
 */

app.get('/getUser', function(req, res, next) {
    if (req.user) {
        return res.send(req.user.getPublic);
    } else {
        return res.send(null);
    }
});


/**
 * Documentation :
 */

/**
 *
 * Introspection-based documentation
 * using app.routes.routes properties
 */

app.get('/documentation', function(req, res) {

    var routesDoc = [];
    var fillRoutesDoc = function(element, index, array) {
        routesDoc.push(element.method.toUpperCase() + ' ' + element.path);
        // @TODO : prototype routes objt adding a getDocumentation method that fetch the documentation var of each route
    };
    app.routes.routes.get.forEach(fillRoutesDoc);
    app.routes.routes.put.forEach(fillRoutesDoc);
    app.routes.routes.post.forEach(fillRoutesDoc);
    app.routes.routes.delete.forEach(fillRoutesDoc);

    res.send({
        "Guacamole API REST server documentation": {
            "Available requests URI": routesDoc,
        }
    });

});

app.get('/*', loadUser, function(req, res, next) {
    if ( public_resources.indexOf(__dirname + '/public/' + req.params[0]) === -1 ) res.render('index.html', { layout: false });
    else next();
});

app.listen(argv.p || argv.port || 3000);

//}