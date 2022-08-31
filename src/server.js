// import express from 'express';


const express = require('express');
const app = express();
const server = require('http').Server(app);

app.use('../../web-mpc/jiff/dist', express.static("../../web-mpc/jiff/dist"));
app.use('../../web-mpc/jiff/lib/ext', express.static("../../web-mpc/jiff/lib/ext"));
app.use('/', express.static("/client"));

var port = 8112;

server.listen(port, function(){
    console.log('Listening on ', port)
});

const JIFFServer = require('../../web-mpc/jiff/lib/jiff-server.js');
const jiffServer = new JIFFServer(server, {logs:true});
console.log("server is running on port", port);
