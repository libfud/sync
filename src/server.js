var fs = require('fs');
var config = require('./config.js');

var ssl_options = {};

// Main application variables
var express = require('express'),
    app = express(),
    server = {};
    
if (config.ssl_enabled) 
{
    ssl_options = {
        key: fs.readFileSync(config.ssl_paths.key),
        cert: fs.readFileSync(config.ssl_paths.cert)
    };
    server = require('https').createServer(ssl_options, app);
}
else
{
    server = require('http').createServer(app);
}

var io = require('socket.io')(server);

server.listen(2333);
console.log("Sync Server Started");

app.use(express.static(__dirname + '/static'));

app.get('/', function(req, res)
{
    console.log("Home page loaded!");
    res.sendFile(__dirname + '/static/index.html');
});

app.get('/:room', function(req, res)
{
    console.log("Room loaded!");
    res.sendFile(__dirname + '/static/sync.html');
});

// Socket variables
var count = 0;
var channels = {};

// Thanks MDN
function random_int(min, max)
{
    max++;
    return Math.floor(Math.random() * (max - min)) + min;
}

io.sockets.on('connection', function(socket)
{
    var user = {};
    
    console.log('User connected');
    socket.emit('connected');
    
    count++;
    io.sockets.emit('stats', {users: count, channels: Object.keys(channels).length});

    socket.on('join', function(channel)
    {
        // Is this dangerous?
        //socket.join(channel);

        // Maybe this is a better idea...
        channel = channel.toString();
        user.channel = channel;
        user.color = {h: random_int(0, 360), s: random_int(25, 100), l: random_int(25, 50)};

        socket.join(channel);

        if(typeof channels[channel] == "undefined")
        {
            // We should probably store the leader's session ID?
            channels[channel] = {users: 0, leader: false};
        }

        // If there is no leader, you get to be a leader!
        if(!channels[channel].leader)
        {
            channels[channel].leader = true;

            // TODO: Leadership should be based on channel
            user.leader = true;
        }

        channels[channel].users++;

        // Tell the user about itself
        socket.emit('join', user);

        // Emit other statistics
        io.sockets.emit('stats', {channels: Object.keys(channels).length});
        io.to(channel).emit('stats', {channel: channels[channel].users});
        console.log("User joined "+channel);
    });
    
    socket.on('chat', function(chat)
    {
        chat.color = user.color;
        io.sockets.emit('chat', chat);
    });

    socket.on('disconnect', function()
    {
        console.log('User disconnected');
        count--;

        // Leave channel if user joined one
        if(typeof user.channel != "undefined")
        {
            if(user.leader)
                channels[user.channel].leader = false;
                
            channels[user.channel].users--;

            // If no one is in this channel anymore
            if(channels[user.channel].users == 0)
                delete channels[user.channel];
            
            socket.leave(user.channel);
            io.to(user.channel).emit('stats', {channel: channels[user.channel].users});
        }

        io.sockets.emit('stats', {users: count, channels: Object.keys(channels).length});
    });
});
