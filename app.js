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
    ;

/**
 * Configuration
 */

nconf.file({ file: './conf.json' });

require('./response');

/**
 * Vars
 */

var db, headers, Document, Tag;

/**
 * Static Resources
 */
var public_resources = [];
tools.readDir(__dirname + '/public', function(err, files){
    public_resources = files;
});


/**
 * Server instance
 */

var app = module.exports = express.createServer();

/**
 * Server configuration
 */

app.configure(function(){
    app.set('views', __dirname + '/views');
    // custom html template
    app.register('.html', {
        compile: function(str, options){
            return function(locals){
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

app.configure('development', function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
    app.use(express.errorHandler());
});

/**
 * Model definition, using mongoose
 *
 * @param {Object} longoose
 * @param {Function} callback
 */

models.define(mongoose, function(){
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

var handleError = function(res, err, status){
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

app.get('/documents', function(req, res){
    Document.getSome(req.query, function(err, docs){
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

app.get('/documents/:id', function(req, res){
    Document.findById(req.params.id, function(err, doc){
        console.log(typeof err);
        res.respond(err || doc || 'Document not found', err ? 500 : (doc ? 200 : 404));
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

app.post('/documents', function(req, res){

    // pour tester
    //curl --silent -F resource=@test.pdf http://localhost:3000/documents | json
    if (req.files.resource){

        // Create document with temp file and resource info
        var doc = new Document(_.extend(req.body, { resource: {
            name: req.files.resource.filename,
            tmp: req.files.resource.path,
        }}));

        // create thumbnail and save
        doc.createThumbnail(nconf.get('documents:thumbs'), function(err){
            if (err) return handleError(res, {'message' : 'Create thumbnail error'});
            else doc.save(function(err){
                if (err) return handleError(res, err);
                res.send(doc);
            });
        });

    } else {
        return handleError(res, {'message' : 'No files resources found'});
    }

});

/**
 * DELETE documents
 *
 * @param {Object} request
 * @param {Object} response
 */

app.del('/documents/:id', function(req, res){

    Document.findById(req.params.id, function(err, doc){
        if (err) return handleError(res, err);
        if (!doc) return res.send(404);
        doc.remove(function(){
            res.send({});
        });
    });

});

/**
 * PUT documents (update)
 */

app.put('/documents/:id', function(req, res){

    Document.findById(req.params.id, function(err, doc){
        if (err) return handleError(res, err);
        if (!doc) return res.send(404);

        fields = req.body;
        if (req.files.resource){
            fields = _.extend(req.body, { resource: {
                name: req.files.resource.filename,
                tmp: req.files.resource.path,
            }});
        }
        doc.set(fields);

        if (req.files.resource) {
            // create thumbnail and save
            doc.createThumbnail(nconf.get('document:thumbs'), function(err){
                if (err) return handleError(res, {'message' : 'Create thumbnail error'});
                else doc.save(function(err){
                    if (err) return handleError(res, err);
                    console.log('save with file');
                    res.send(doc);
                });
            });
        } else {
            // just save
            doc.save(function(err){
                if (err) return handleError(res, err);
                res.send(doc);
            })
        }
    });

/*
    // todo : gérer pièce jointe
    // todo : si pj, recalculer thumbnail ?

    Document.findById(req.params.id, function(err, doc){
        if (err) return handleError(res, err);
        if (!doc) return res.send(404);
        doc.set(req.body);
        doc.save(function(err){
            if (err) return handleError(res, err);
            return res.send(doc, headers);
        });
    });
*/
});

/**
 * Mass deletion of documents
 *
 * @param {Object} request
 * @param {Object} response
 * @return {Json} status
 * @api public
 */

app.post('/documents/batch/delete', function(req, res){

    Document.find({ _id: req.params.ids }, function(err, docs){
        if (err) return handleError(res, err);
        _.each(docs, function(doc){
            doc.remove();
        })
//            res.send({}, headers);
//        });
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

app.get('/documents/:id/thumbnail', function(req, res){
   res.send('toto');
});

app.update('/documents/:id/thumbnail/', function(req, res){
   res.send('toto');
});

/**
 * UPDATE thumbnail of document (id)
 */

// app.update('/thumbnail/:id', function(req, res){

// }):


/**
 * TAGS Routes :
 */

/**
 * GET /tags : all tags
 */

app.get('/tags', function(req, res){

    var query = {};
    var subdirsof;

    // Récupération des /tags fils direct d'un /tag
    if (subdirsof = req.query.subdirsof){
        subdirsof = subdirsof.replace(new RegExp('/+$', 'g'), '');
        var regexp = new RegExp("^" + subdirsof + "/", "i");
        var deep = subdirsof.split('/').length + 1;
        query = { $and: [
            { label: regexp },
            { $where: "this.label.split('/').length === " + deep }
        ]};
        if (subdirsof === '') query.$and.push({ label: { $ne: '/' } });
    }

    Tag.find(query).sort('label', 'ascending').execFind(function (err, tags) {
        if (err) return handleError(res, err);
        res.send(tags);
    });

});

/**
 * POST tags (create)
 */

app.post('/tags', function(req, res, headers){

    // TODO
    res.writeHead(501, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'not implemented' }));

});

app.del('/tags/:id', function(req, res, headers){

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

app.get('/documentation', function(req, res, headers){

    var routesDoc = [];
    var fillRoutesDoc = function(element, index, array){
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
    }, headers);

});



app.get('/*', function(req, res, next){
    if ( public_resources.files.indexOf(__dirname + '/public/' + req.params[0]) === -1
    && public_resources.dirs.indexOf(__dirname + '/public/' + req.params[0]) === -1 ) res.render('index.html', { title: 'guacamole', layout: false });
    else next();
});


app.listen(nconf.get('application:port'));
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
