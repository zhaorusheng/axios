'use strict';

var utils = require('./../utils');
var buildURL = require('../helpers/buildURL');
var InterceptorManager = require('./InterceptorManager');
var dispatchRequest = require('./dispatchRequest');
var mergeConfig = require('./mergeConfig');

/**
 * Axios 构造函数
 *
 * @param {Object} instanceConfig: 默认配置
 */
function Axios(instanceConfig) {
  this.defaults = instanceConfig;

  // 拦截器,外面如此调用: axios.interceptors.request.use||axios.interceptors.response.use
  // use方法在InterceptorManager（拦截器）原型链中
  this.interceptors = {
    request: new InterceptorManager(),
    response: new InterceptorManager()
  };
}

/**
 * request请求方法实现
 *
 * @param {Object} config The config specific for this request (merged with this.defaults)
 */
Axios.prototype.request = function request(config) {
  /*eslint no-param-reassign:0*/
  // Allow for axios('example/url'[, config]) a la fetch API
  // 如果config是string类型的话，就说明是axios('example/url'[, config]) 此方式调用，第一个参数是url，第二个参数是config
  if (typeof config === 'string') {
    config = arguments[1] || {};
    config.url = arguments[0];
  } else {
    config = config || {};
  }

  config = mergeConfig(this.defaults, config);
  config.method = config.method ? config.method.toLowerCase() : 'get';

  // Hook up interceptors middleware
  // dispatchRequest发起请求的方法
  var chain = [dispatchRequest, undefined];
  var promise = Promise.resolve(config);

  // 以下两个方法分别依次遍历请求拦截和响应拦截方法  interceptor拦截器
  // interceptor.fulfilled成功 interceptor.rejected)失败

  // 把请求拦截方法，添加到拦截器链的前面,每两个为一组（fulfilled,rejected）
  this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
    chain.unshift(interceptor.fulfilled, interceptor.rejected);
  });

  // 把响应拦截方法，添加到拦截器链的后面,每两个为一组（fulfilled,rejected）
  this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
    chain.push(interceptor.fulfilled, interceptor.rejected);
  });


  // 依次执行拦截器链(chain)中的每一组拦截器方法，
  // [dispatchRequest, undefined] 是发起请求方法
  // 其中[dispatchRequest, undefined] 之前的为请求拦截方法，之后的为响应拦截方法
  while (chain.length) {
    // 因为 Promise.resolve(config) ，chain.Shift()方法可以直接接收config参数
    // 根据promise.then的特性，即使提供非函数 (nonfunction) 参数也不会报错
    // MDN:https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/then
    promise = promise.then(chain.shift(), chain.shift());
  }
  return promise;
};

Axios.prototype.getUri = function getUri(config) {
  config = mergeConfig(this.defaults, config);
  return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, '');
};

// Provide aliases for supported request methods
utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url
    }));
  };
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, data, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url,
      data: data
    }));
  };
});

module.exports = Axios;
