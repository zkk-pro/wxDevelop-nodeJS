const express = require('express');
const config = require('./config');
const WeChat = require('./wecaht/wechat');

let app = express();
let token = 'mynsy';

let wechatApp = new WeChat(config)
// 访问主页: 1.如果是微信访问返回echostr随机字符串，2.如果是网页访问返回‘嘤嘤嘤’
app.get('/', (req, res) => {
  wechatApp.auth(req, res);
});

// 访问后返回access_token
app.get('/getAccessToken', (req, res) => {
  wechatApp.getAccessToken().then(data => {
    res.send(data);
  })
});

// 用于处理所有进入3000端口的 post 的链接请求
app.post('/', (req, res) => {
  wechatApp.handleMsg(req, res);  
})

app.listen(3000, 'localhost', () =>{
  console.log('app run 127.0.0.1:3000');
});

