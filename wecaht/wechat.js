'use strict'

const crypto = require('crypto');
const https = require('https');
const util = require('util');
const fs = require('fs');
const urltil = require('url');
const parseString = require('xml2js').parseString; // xml数据解析插件
const accessTokenJson = require('./access_token'); // access_token信息
const menus = require('./menus'); // 菜单配置
const msg = require('./msg'); // 消息处理模块

// 构建WeChat对象
let WeChat = function (config) {
  this.config = config; // 设置WeChat 对象的属性 config
  this.token = config.token; // 设置WeChat对象的属性 token
  this.appID = config.appID; // 设置WeChat对象的属性 appID
  this.appScrect = config.appScrect; // 设置WeChat对象的属性 appScrect
  this.apiDomain = config.apiDomain; // 设置WeChat对象的属性 apiDomain
  this.apiURL = config.apiURL; // 设置WeChat对象的属性 apiURL

  // 用于处理https Get请求方法：获取access_token
  this.requestGet = function (url) {
    return new Promise(function (resolve, reject) {
      https.get(url, function (res) {
        let buffer = '';
        let result = '';
        // 监听data数据传输事件
        res.on('data', data => {
          // buffer.push(data);
          buffer += data;
        });
        // 监听数据传输完成
        res.on('end', () => {
          // result = Buffer.concat(buffer, buffer.length).toString('utf-8');
          // result = buffer.toString('utf-8');
          result = buffer;
          resolve(result); // 将结果返回
        });
      }).on('error', err => {
        reject(err);
      });
    });
  }

  // 用于处理https Post请求方法：设置公众号自定义菜单
  this.requirePost = function (url, data) {
    return new Promise(function (resolve, reject) {
      // 解析url
      console.log(url)
      let urlData = urltil.parse(url);
      // 设置https.request options 传入的参数对象
      let options = {
        hostname: urlData.hostname, // 主机地址
        path: urlData.path, // 路径
        method: 'POST', // 请求方法
        // 设置请求头
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(data, 'utf-8')
        }
      };

      // 发送请求
      let req = https.request(options, res => {
        let result = '';
        res.on('data', data => {
          result += data;
        });

        res.on('end', () => {
          resolve(result);
        });
      }).on('error', err => { // post 请求错误事件
        console.log(err);
        reject(err);
      });
      req.write(data);
      req.end();
    });
  }
}

// 微信接入认证
WeChat.prototype.auth = function (req, res) {
  // 创建菜单
  let that = this;
  this.getAccessToken().then(data => {
    // 格式化链接
    let url = util.format(that.apiURL.createMenu, that.apiDomain, data)

    // 发送请求创建自定菜单借口
    that.requirePost(url, JSON.stringify(menus)).then(data => {
      console.log(data)
    });
  })

  // 1、获取微信服务器Get请求的参数
  let signature = req.query.signature, // 微信加密
    timestamp = req.query.timestamp, // 时间戳
    nonce = req.query.nonce, // 随机数
    echostr = req.query.echostr; // 随机字符串

  // 2、将token, timestamp, nonce 进行字典排序
  let arr = [this.token, timestamp, nonce];
  arr.sort();

  // 3、将排序后的数组拼接成一个字符串并进行sha1加密
  let tempStr = arr.join(''); // 数据拼接成一个字符串
  const hashCode = crypto.createHash('sha1'); // 创建加密类型
  let resultCode = hashCode.update(tempStr, 'utf8').digest('hex'); // 对传入的字符串进行加密

  // 4、开发者获得加密后的字符串与微信的signature对比，相等说明请求来源与微信
  if (resultCode === signature) {
    res.send(echostr);
  } else {
    res.send('<h1>嘤嘤嘤</h1>');
  }
}

// 获取微信 access_token
WeChat.prototype.getAccessToken = function () {
  let that = this;
  return new Promise(function (resolve, reject) {
    let currentTime = new Date().getTime(); // 获取当前时间
    // 格式化请求地址
    let url = util.format(that.apiURL.accessTokenApi, that.apiDomain, that.appID, that.appScrect);

    // let url = 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=' + that.appID + '&secret=' + that.appScrect;
    // 判断本地储存的 access_token 是否有效
    if (accessTokenJson.access_token === '' || accessTokenJson.expires_time < currentTime) {
      that.requestGet(url).then(function (data) {
        var result = JSON.parse(data);
        if (data.indexOf('errcode') < 0) {
          accessTokenJson.access_token = result.access_token;
          accessTokenJson.expires_time = new Date().getTime() + (parseInt(result.expires_in) - 200) * 1000;
          console.log(accessTokenJson)
          // 更新本地储存
          fs.writeFile(__dirname + '/access_token.json', JSON.stringify(accessTokenJson), err => {
            if (err) throw err;
          });
          // 将获取后的 access_token 返回
          resolve(accessTokenJson.access_token);
        } else {
          resolve(result); // 将错误返回
        }
      });
    } else {
      // 将本地储存的 access_token 返回
      resolve(accessTokenJson.access_token);
    }
  })
}

// 微信消息
WeChat.prototype.handleMsg = function (req, res) {
  let result = '';
  // 监听 data 事件，用于接受数据
  req.on('data', data => {
    result += data;
  });
  // 监听数据接收完成
  req.on('end', () => {
    // 解析xml数据
    parseString(result, { explicitArray: false }, (err, final) => {
      if (!err) {
        // console.log(final);
        final = final.xml;
        let toUser = final.ToUserName; // 接收方微信
        let fromUser = final.FromUserName; // 发送方微信
        // 判断事件类型 toLowerCase
        switch (final.Event.toLowerCase()) {
          case 'subscribe': // 关注事件
            // 回复消息，注意回复人的和被回复人的顺序            
            res.send(msg.txtMsg(fromUser, toUser, '欢迎关注呵呵哒公众号，let\'s we up'));
            break;
        }
      } else {
        throw err;
      }
    });
    console.log(result)
  });
}

module.exports = WeChat;