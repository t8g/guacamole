var http = require('http');

/**
 * Monkey-patch adding "res.respond(...)"
 * Usages:
 *  - res.respond(content as string or object) → 200 OK, with JSON encoded content
 *  - res.respond(status as number) → given status, with undefined content
 *  - res.respond(content, status) → ok, you got it :)
 */
http.ServerResponse.prototype.respond = function (content, status) {
  if ('undefined' == typeof status) { // only one parameter found
    if ('number' == typeof content || !isNaN(parseInt(content))) { // usage "respond(status)"
      status = parseInt(content);
      content = undefined;
    } else { // usage "respond(content)"
      status = 200;
    }
  }
  if (status != 200) { // error
    content = {
      "code":    status,
      "status":  http.STATUS_CODES[status],
      "message": content && content.toString() || null
    };
  }
  if ('object' != typeof content) { // wrap content if necessary
    content = {"result":content};
  }
  // respond with JSON data
  this.send(JSON.stringify(content)+"\n", status);
};
