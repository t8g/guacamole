

var APIeasy = require('api-easy'),
    sys = require('sys'),
    assert = require('assert'),
    route = {'host': "localhost", 'port': 4000};


var suite = APIeasy.describe('your/awesome/api');


//usage : https://github.com/indexzero/api-easy/#using-api-easy
// exmaple : https://github.com/indexzero/api-easy/blob/master/test/run-test.js
suite.discuss('When using Guacamole REST API')
    .use(route.host, route.port)
    .setHeader('Content-Type', 'application/json')
    //.post({ test: 'data' })

    // --- GET documents/+ ---
    .get('/')
    .expect('should contains a dropzone', function (err, res, body) {
        assert.ok(body.toString().contains('dropzone'))
        console.log(body.toString());
    })
    .get('/documents')
    .expect(200)
    .get('/documents/donotremovejpg')
    .expect(200)
    .expect('should contains valid response', function (err, res, body) {
        body = JSON.parse(body);
        assert.equal(body.slug, 'donotremovejpg');
        assert.equal(body.resource.name, 'donotremove.jpg');
    })


    // --- GET tags/+ ---
    .get('/tags')
    .expect(200)

    // --- GET documentation ---
    .next()
    .get('/documentation')
    .expect(200)

    //.expect(200, { ok: true })
    //.expect('should respond with x-test-header', function (err, res, body) {
    // assert.include(res.headers, 'x-test-header');
    //})
.export(module);
/*
vows.describe('Guacamole routes test suite').addBatch({
    'GET /': {
        topic: api.get('/'),
        'should respond with a 200 OK': assertStatus(200)
    },
    'GET /documents': {
        topic: api.get('/documents'),
        'should respond with a 200 OK': assertStatus(200)
    },
    'GET /documents/donotremovejpg': {
        topic: api.get('/documents/donotremovejpg'),
        'should respond with a 200 OK': assertStatus(200),
    },
    'GET /documents/donotremovejpg': {
        topic: api.getBody('/documents/donotremovejpg'),
        'should respond with a 200 OK': assertContains('jpg')
    },
    'GET /tags': {
        topic: api.get('/tags'),
        'should respond with a 200 OK': assertStatus(200)
    },
    'GET /tags/semantic': {
        topic: api.get('/tags/semantic'),
        'should respond with a 200 OK': assertStatus(200)
    },
    'GET /tags/starting/a': {
        topic: api.get('/tags/semantic'),
        'should respond with a 200 OK': assertStatus(200)
    },
     'GET /tags/starting/zzz': {
        topic: api.get('/tags/semantic'),
        //'should respond with a 204 OK': assertStatus(204)
        // Unfortunatly 204 does not work. a firebug try using $.get() return 204 anyway...
        'should respond with a 200 (well, a 204 in fact)': assertStatus(200)
    },
    'GET /tags/treeview': {
        topic: api.get('/tags/treeview'),
        'should respond with a 200 OK': assertStatus(200)
    },
    'GET /documentation': {
        topic: api.get('/documentation'),
        'should respond with a 200 OK': assertStatus(200)
    }
}).run();
*/
