# skroutz.js
An npm module for using the skroutz.gr API with nodeJS 

## Installation
```bash
npm install skroutz
```
## Quick start

Once you have an ```Identifier``` and a ```Secret``` you are ready to create a client.
```js
var Client = require('skroutz');

var client = new Client({
	'client_id': 'Identifier',
	'client_secret': 'Secret'
});
```
After that, using the client to access the API is as simple as passing the methods you want and calling ```fetch()```.
```js
client.Shop(40).fetch(function (err, response) {
 if(err){throw err;}
	console.log(response);
});

client.Category(40).skus().params({
	q: "samsung galaxy s8"
}).fetch(function (err, response) {
	console.log(response);
});

```
## Available resources
```js
client.Autocomplete()
client.Category()
client.Flag()
client.Manufacturer()
client.Product()
client.Search()
client.Shop()
client.Sku()
```

## Usage
- Accessing a specific API route is very simple. The URL is translated from all the method calls on the client object. For example if you want to access ```GET /categories/root``` you simply use ```js client.Category().root()```. The fetch method must be called with a callback function argument in the end of the API call like this:
```js
 .fetch(function(err, respond){ }); 
``` 
The final query will look like this:
```js 
client.Category().root().fetch(function(err, response){
//Check for errors and use the data from the api
});
```
- Accessing routes that use dynamic URIs like ```GET /categories/:id/parent``` is as simple as using ```js client.Category(id).parent()``` and then fetching.
- Accessing routes with parameters at the end like: ```GET http://api.skroutz.gr/categories/40/skus?manufacturer_ids[]=28&manufacturer_ids[]=2``` will require the use of the method ```js .params({manufacturer_ids[]: 28, manufacturer_ids[]: 2})``` like this: 
```js 
client.Category(40).skus().params(({manufacturer_ids[]: 28, manufacturer_ids[]: 2})
``` 
and then fetching.

## Conditional Requests
Most responses return Last-Modified and ETag headers. You can use the values of these headers to make subsequent requests to those resources. This headers are accessed by using ```js response.cache[`etag`]``` and ```js response.cache[`last-modified`]```. You can only use one of them for every request by using either the method```js.cacheEtag("the etag string")``` or ```js .cacheModified("Current date")``` before the fetch method. If no new data is available this small json will be present on the response: 
```js { cached: true }```
