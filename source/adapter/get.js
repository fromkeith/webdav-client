var xml2js = require("xml2js"),
    deepmerge = require("deepmerge")
    jstoxml = require("jstoxml");

var fetch = require("./request.js"),
    parsing = require("./parse.js"),
    responseHandlers = require("./response.js");


function getStat(url, itemPath, options, parseFullResult) {
        options = options || {};
        var constructedBody;
        if (options.props) {
            var i;
            var props = {}, propName;
            for (i = 0; i < options.props.items.length; i++) {
                if (options.props.items[i].prefix) {
                    propName = options.props.items[i].prefix + ':' +  options.props.items[i].name;
                } else {
                    propName = 'd:' + options.props.items[i];
                }
                props[propName] = {
                    _selfCloseTag: true
                };
            }
            var namespaces = {"xmlns:d": "DAV:"};
            if (options.props.ns) {
                var keys = Object.keys(options.props.ns);
                for (i = 0; i < keys.length; i++) {
                    namespaces['xmlns:' + keys[i]] = options.props.ns[keys[i]];
                }
            }
            constructedBody = jstoxml.toXML({
                _name: "d:propfind",
                _attrs: namespaces,
                _content: {
                    "d:prop": props,
                }
            }, {header: true});
        }
        return fetch(url + itemPath, {
                method: "PROPFIND",
                headers: deepmerge(
                    {
                        Depth: 1
                    },
                    options.headers || {}
                ),
                body: constructedBody
            })
            .then(responseHandlers.handleResponseCode)
            .then(function(res) {
                return res.text();
            })
            .then(function(body) {
                var parser = new xml2js.Parser({
                    ignoreAttrs: true
                });
                return new Promise(function(resolve, reject) {
                    parser.parseString(body, function (err, result) {
                        if (err) {
                            reject(err);
                        } else {
                            var targetPath = itemPath;
                            if (!parseFullResult) {
                                targetPath = itemPath.replace(/^\//, "");
                            }
                            resolve(parsing.parseDirectoryLookup(targetPath, result, options.props, !parseFullResult));
                        }
                    });
                });
            })
            .then(function(stats) {
                if (parseFullResult) {
                    return stats;
                }
                return stats.shift();
            });
    }

module.exports = {

    /*
        @url the url to request
        @dirPath the path to look at. Default '/'
        @options {
            header: map of headers,
            props: {
                items : array of properties to get: ['getlastmodified'] or [{prefix: 'oc', name: 'favorite'}]
                ns: array of extra namespace definitions: [{'xmlns:oc': 'http://owncloud.org/ns"'}]
                    by default 'd:' is reserved for DAV:
            }
        }
    */
    getDirectoryContents: function getDirectoryContents(url, dirPath, options) {
        return getStat(url, dirPath || "/", options, true);
    },

    getFileContents: function getFileContents(url, filePath, options) {
        options = options || { headers: {} };
        return fetch(url + filePath, {
                method: "GET",
                headers: options.headers
            })
            .then(responseHandlers.handleResponseCode)
            .then(function(res) {
                return res.buffer();
            });
    },

    /*
        @url the url to request
        @dirPath the path to look at.
        @options {
            header: map of headers,
            props: {
                items : array of properties to get: ['getlastmodified'] or [{prefix: 'oc', name: 'favorite'}]
                ns: array of extra namespace definitions: [{'xmlns:oc': 'http://owncloud.org/ns"'}]
                    by default 'd:' is reserved for DAV:
            },
        }
    */
    getStat: getStat,

    getTextContents: function getTextContents(url, filePath, options) {
        options = options || { headers: {} };
        return fetch(url + filePath, {
                headers: options.headers
            })
            .then(responseHandlers.handleResponseCode)
            .then(function(res) {
                return res.text();
            });
    }

};
