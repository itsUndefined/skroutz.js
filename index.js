'use strict';
const https = require('follow-redirects').https;
const querystring = require('querystring');
const fs = require('fs');
var err;

function Client(auth, callback) {
	this.authProm = new Promise((resolve, reject) => {
		authorize(auth, (err, token) => {
			if (err) {
				reject(err);
			}
			resolve(token);
		});
	});
	this.authProm.then((token) => {
		if (typeof callback == 'function') {
			callback(null, token);
		}
	}, (err) => {
		if (typeof callback == 'function') {
			callback(err, null);
		}
	});
}


module.exports = function (auth, callback) {
	let methods = [];
	let params;
	let cacheETag;
	let cacheModified;
	return new Proxy(new Client(auth, callback), {
		get: (target, property, receiver) => {
			if (property == "fetch") {
				return (callback) => {
						var currentParams = params;
						var currentMethods = methods;
						var currentCacheETag = cacheETag;
						var currentCacheModified = cacheModified;
						params = undefined;
						cacheETag = undefined;
						cacheModified = undefined;
						methods = [];
						if (typeof callback == 'function') {
							target.authProm.then((token) => {
									callAPI(currentMethods, currentParams, currentCacheETag, currentCacheModified, token, (err, response) => {
										if (err) {
											return callback(err, null);
										}
										return callback(null, response);
									});
								},
								(err) => {
									return callback(err, null);
								});
						} else {
							return new Promise((resolve, reject) => {
								target.authProm.then((token) => {
										callAPI(currentMethods, currentParams, currentCacheETag, currentCacheModified, token, (err, response) => {
											if (err) {
												return reject(err);
											}
											return resolve(response);
										});
									},
									(err) => {
										return reject(err);
									});
							});
						}
				};
			} else if (property == "params") {
				if (params === undefined) {
					return (parameters) => {
						params = parameters;
						return receiver;
					};
				} else {
					err = "Used multiple params() methods on one API call. Use only one object.";
					throw new Error(err);
				}
			} else if (property == "cacheETag") {
				if (cacheETag === undefined && cacheModified === undefined) {
					return (ETag) => {
						cacheETag = ETag;
						return receiver;
					};
				} else {
					err = "Using cacheEtag() with cacheModified() method on one API call is prohibited.";
					throw new Error(err);
				}
			} else if (property == "cacheModified") {
				if (cacheModified === undefined && cacheModified === undefined) {
					return (lastModified) => {
						cacheModified = lastModified;
						return receiver;
					};
				} else {
					err = "Using cacheEtag() with cacheModified() method on one API call is prohibited.";
					throw new Error(err);
				}
			} else {
				return (args) => {
					methods.push({
						property: property,
						args: args
					});
					return receiver;
				};
			}
		}
	});
};

const resources = {
	'Autocomplete': '/autocomplete',
	'Category': '/categories',
	'Flag': '/flags',
	'Manufacturer': '/manufacturers',
	'Product': '/products',
	'Search': '/search',
	'Shop': '/shops',
	'Sku': '/skus'
};


function callAPI(methods, params, cacheEtag, cacheModified, token, callback) {
	if (resources.hasOwnProperty(methods[0].property)) {
		const resourceURI = resources[methods[0].property];
		var path;
		if (methods[0].args !== undefined) {
			path = resourceURI + '/' + methods[0].args + '/';
		} else {
			path = resourceURI;
		}
		for (let i = 1; i < methods.length; i++) {
			path += methods[i].property + '/';
			if (methods[i].args !== undefined) {
				path += methods[i].args + '/';
			}
		}
		if (params) {
			path = path.slice(0, path.length - 1) + '?' + querystring.stringify(params);
		}
		let headers = {
			'Accept': 'application/vnd.skroutz+json; version=3.1',
			'Authorization': 'Bearer ' + token
		};
		if (cacheEtag) {
			headers['If-None-Match'] = cacheEtag;
		} else if (cacheModified) {
			headers['If-Modified-Since'] = cacheModified;
		}
		https.get({
			hostname: 'api.skroutz.gr',
			path: path,
			headers: headers
		}, (res) => {
			if (res.statusCode !== 200 && res.statusCode !== 404 && res.statusCode !== 304 && res.statusCode !== 400 && res.statusCode !== 401 && res.statusCode !== 403 && res.statusCode !== 404 && res.statusCode !== 500 && res.statusCode !== 501) {
				err = new Error("Unexpected HTTP response. HTTP error code: " + res.statusCode);
				return callback(err, null);
			} else if (res.statusCode == 404) {
				err = new Error("Error 404. Not Found. Resource does not exist.");
				return callback(err, null);
			} else if (res.statusCode == 400) {
				err = new Error("Error 400. Bad request. A required parameter is missing or incorrect.");
				return callback(err, null);
			} else if (res.statusCode == 401) {
				err = new Error("Error 401. Invalid client credentials.");
				return callback(err, null);
			} else if (res.statusCode == 500) {
				err = new Error("Error 500. Internal Server Error. Something is broken.");
				return callback(err, null);
			} else if (res.statusCode == 501) {
				err = new Error("Error 501. Not Implemented. The requested action is not implemented.");
				return callback(err, null);
			} else if (res.statusCode == 403) {
				err = new Error("Error 403. Access forbidden. Was the API rate limit reached?");
				return callback(err, null);
			} else if (res.statusCode == 304) {
				return callback(null, {
					cached: true
				});
			}
			res.setEncoding('utf8');
			let rawData = '';
			res.on('data', (chunk) => {
				rawData += chunk;
			});
			res.on('end', () => {
				try {
					let serverResponse = JSON.parse(rawData);
					serverResponse[`cache`] = {};
					if (res.headers.hasOwnProperty('etag')) {
						serverResponse[`cache`][`etag`] = res.headers[`etag`];
					}
					if (res.headers.hasOwnProperty('last-modified')) {
						serverResponse[`cache`][`last-modified`] = res.headers[`last-modified`];
					}
					return callback(null, serverResponse);
				} catch (err) {
					return callback(err, null);
				}
			});
		}).on('error', (err) => {
			return callback(err, null);
		});
	} else {
		err = new Error("Undefined resource " + methods[0].property + " called.");
		return callback(err, null);
	}
}

function authorize(auth, callback) {
	if (auth !== undefined && auth.hasOwnProperty('client_id') && auth.hasOwnProperty('client_secret')) {
		const authData = {
			client_id: auth.client_id,
			client_secret: auth.client_secret,
			grant_type: 'client_credentials',
			scope: 'public'
		};
		const authURI = "/oauth2/token?" + querystring.stringify(authData);
		let formData = {
			'grant_type': 'client_credentials'
		};
		const parsedForm = querystring.stringify(formData);
		const options = {
			hostname: 'www.skroutz.gr',
			path: authURI,
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': 29
			}
		};
		var getToken = https.request(options, (res) => {
			if (res.statusCode != 200 && res.statusCode != 401) {
				err = new Error("Unexpected HTTP response. HTTP error code: " + res.statusCode);
				return callback(err, null);
			} else if (res.statusCode == 401) {
				err = new Error("Error 401. Invalid client credentials.");
				return callback(err, null);
			}
			res.setEncoding('utf8');
			let rawData = "";
			res.on('data', (chunk) => {
				rawData += chunk;
			});
			res.on('end', () => {
				try {
					const serverResponse = JSON.parse(rawData);
					if (serverResponse.hasOwnProperty('access_token')) {
						var token = serverResponse.access_token;
						return callback(null, token);
					} else {
						err = new Error("Unexpected DATA from SKROUTZ API");
						return callback(err, null);
					}
				} catch (err) {
					return callback(err, null);
				}
			});
		});
		getToken.on('error', (err) => {
			return callback(err, null);
		});
		getToken.write('grant_type=client_credentials');
		getToken.end();
	} else {
		err = new Error("Wrong or missing authentication object. Use an object with the keys 'client_id' and 'client_secret'");
		return callback(err, null);
	}
}
