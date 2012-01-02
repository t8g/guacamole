    /**
 * Guacamole.js
 * Copyright (c) 2011 Toog <contact@toog.fr>
 * MIT Licensed
 */

/**
 * Module dependencies
 */

var express = require('express')
    ,mongoose = require('mongoose')
    ,models = require('./models')
    ,_ = require('underscore')
    ,fs = require('fs')
    ,nconf = require('nconf')
    ,tools = require('./tools')
    ,async = require('async')
    ,zip = require('node-native-zip')
    ;

/**
 * Configuration
 */

nconf.file({ file: './conf.json' });

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
    //app.use(express.compiler({ src: __dirname + '/public', enable: ['less'] }));
    app.use(express.bodyParser({ keepExtensions: true, uploadDir: nconf.get('documents:dirs:tmp') }));
    app.use(express.methodOverride());
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
        res.respond(err || doc, err ? 500 : ( doc ? 200 : 404 ));
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
 * DELETE documents
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


// T'es en train de bosser ici !!!

        if (err) return handleError(res, err);
        if (!doc) return res.send(404);

        fields = req.body;
        if (req.files.resource) {
            fields = _.extend(req.body, { resource: {
                name: req.files.resource.filename,
                tmp: req.files.resource.path,
            }});
        }
        doc.set(fields);

        if (req.files.resource) { // create thumbnail and save
            doc.createThumbnail(function(err) {
                err ? res.respond(err, 500) : doc.save(function(err) {
                    res.respond(err || doc, err ? 500 : 200);
                });
            });
        } else { // just save
            doc.save(function(err) {
                res.respond(err || doc, err ? 500 : 200);
            })
        }
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
                tags = _.difference(tags, req.body.todelete);
                tags = _.union(tags, req.body.toadd);
                doc.tags = tags;
                doc.save(fn);
            },
            function(err) {
                console.log('fin');
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

app.get('/documents/:id/thumbnail', function(req, res) {

    // @TODO : vérif droits

    Document.findById(req.params.id, function(err, doc) {
        if (err || _.isEmpty(doc)) res.respond('File Not Found', 404);

        // get generated thumbnail or default (mime dependent)
        var file = doc.resource.thumbnail
            ? nconf.get('documents:dirs:thumbs') + doc.resource.thumbnail
            : nconf.get('thumbnails:default-path') + (nconf.get('thumbnails:default')[doc.resource.mime] || nconf.get('thumbnails:default')['*'] || 'default.png');

        // A Mettre dans un module ... ou utiliser static ??? ---> pb du directory
        // Et à factoriser avec /documents/:id/file
        fs.stat(file, function(err, stat) {

            // ignore ENOENT
            if (err) {
              return 'ENOENT' == err.code
                ? res.respond('File Not Found', 404)
                : next(err);
            } else if (stat.isDirectory()) {
              return next();
            }

            //res.setHeader('Date', new Date().toUTCString());
            //res.setHeader('Last-Modified', stat.mtime.toUTCString());
            res.setHeader('Content-Type', 'image/' + nconf.get('thumbnails:options:format'));// + (charset ? '; charset=' + charset : ''));
            //res.setHeader('Content-Length', stat.size);
            //res.setHeader('Content-Disposition: attachment; filename="'+doc.resource.name+'"');

            // stream
            var stream = fs.createReadStream(file);
            req.emit('static', stream);
            stream.pipe(res);

        });

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
        // @TODO : statistiques de téléchargement
        var file =

        tools.serve(
            nconf.get('documents:dirs:files') + doc.resource.file,
            [
                {name: 'Date', value: new Date().toUTCString()},
                //{name: 'Last-Modified', value: stat.mtime.toUTCString()},
                {name: 'Content-Type', value: doc.resource.mime},
                {name: 'Content-Disposition: attachment; filename="'+doc.resource.name+'"'}
            ],
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

app.get('/*', function(req, res, next) {
    if ( public_resources.indexOf(__dirname + '/public/' + req.params[0]) === -1 ) res.render('index.html', { layout: false });
    else next();
});


app.listen(nconf.get('application:port'));
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
