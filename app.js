const express = require('express');
const config = require('./config');
const WeChat = require('./wecaht/wechat');

let app = express();
let token = 'mynsy';

let wechatApp = new WeChat(config)

app.get('/', (req, res) => {
  wechatApp.auth(req, res);
});

app.listen(3000, 'localhost', () =>{
  console.log('app run 127.0.0.1:3000');
});

app.get('/getAccessToken', (req, res) => {
  wechatApp.getAccessToken().then(data => {
    res.send(data);
  })
})