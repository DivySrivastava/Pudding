'use strict';
const express = require('express');
const formidable = require("formidable");
const fs = require("file-system");
const path = require('path');
const router = express.Router();
const tool = require('array-tools')

const user = require(path.join(__dirname, '../../../', 'utils/handlers/user'));
const User = require(path.join(__dirname, '../../../', 'utils/models/user'));


const formParser = require(path.join(__dirname, '../../../','utils/form-parser.js'));
const ig = require(path.join(__dirname, '../../../', 'config/instagram'));
const g = require(path.join(__dirname, '../../../', 'config/google'));

router.post('/comment', function(req, res, next) {
  user.comment({username:req.body.author},{by:req.session.user,text:req.body.text},req.body._id, (err, result)=> {
    if(result) {
      res.send(true)
    }
    else {
      res.send(false)
    }
  });
});

router.post('/like', function(req, res, next) {
  user.like({username:req.body.author},{by:req.session.user},req.body._id, (err, result) => {
    if(result) {
        res.send({event:true,msg:"Liked!"})
      }
      else {
        res.send({event:false,msg:"Already liked."})
      }
  });
});

router.post('/follow', function(req, res, next) {
  user.findOne(req.body, (err, user) => {
    var disabled = false;
    for(var i=0;i<user.followers.length;i++) {
      if(user.followers[i] == req.session._id) {
        console.log(i)
        return disabled=true;
      }
    }
    if(disabled) {
      res.status(200).send('disabled')
    }
    else {
       user.followers.push(req.session._id);
       user.notifications.push({
         msg:`${req.session.user} started following you.`,
         link:`/u/${req.session.user}`,
         time:new Date()
       });
      user = User(user);
      user.save((err) => {
        res.status(200).send('done')
      });
    }
  });
});

router.post('/user/:mode', function(req, res, next) {
  if(!req.session.user) return res.sendStatus(404);
  if(req.params.mode == 'picture') {
    user.findOne({_id: req.query.id}, (err, user) => {
      if(!user) return res.sendStatus(404);
      var image_types = ["png","jpeg","gif", "jpg"];
      var form = new formidable.IncomingForm();

      form.parse(req);
      form.on('fileBegin', function (name, file){
        if(!image_types.includes(file.name.split('.')[1].toLowerCase())) {
          return res.status(404).send('Unsupported file type!');
        }
        if(fs.existsSync((__dirname.split('/routes')[0] + '/public/images/profile_pictures/' + user.username + '.' + file.name.split('.')[1]))) {
          fs.unlinkSync(__dirname.split('/routes')[0] + '/public/images/profile_pictures/' + user.username + '.' + file.name.split('.')[1])
        }
        file.path = __dirname.split('/routes')[0] + '/public/images/profile_pictures/' + user.username + '.' + file.name.split('.')[1];
      });
      
      form.on('file', function (name, file){
        if(!image_types.includes(file.name.split('.')[1].toLowerCase())) {
          return;
        }
        user['profile_pic'] = "/images/profile_pictures/" + user.username + '.' + file.name.split('.')[1];
        user.save((err, profile) => {
          delete req.session.user;
          req.session.user = profile.username;
          req.session._id = profile._id;
          res.status(200).send("/images/profile_pictures/" + user.username + '.' + file.name.split('.')[1])
        });
      });
      return;
    })
    return;
  }

  user.findOne({_id: req.body._id}, (err, user) => {
    if(err) return res.end(err);
    if(!user) return res.sendStatus(404);
    
    user[req.body.key] = req.body.value;
    user.save((err, profile) => {
        delete req.session.user;
        req.session.user = profile.username;
        req.session._id = profile._id;
        res.status(200).send('done')
    });
  });
});

router.get('/search', function(req, res, next) {
  var regx = '^'+req.query.q+'.*';
  User
  .find({$or:[
        {username:{$regex:regx, $options: 'i'}},
            {firstname:{$regex:regx, $options: 'i'}},
            {lastname:{$regex:regx, $options: 'i'}}
  ]})
  .exec((err, all) => {
    return res.send(all);
  });
});

router.get('/oauth/:service', function(req, res, next) {
  if(req.params.service == 'instagram') res.redirect(ig.auth_url);
  if(req.params.service == 'google') res.redirect(g.auth_url);
});

router.get('/notifications', function(req, res, next) {
  User
  .findOne({_id:req.session._id})
  .exec((err, userData) => {
    res.send(new String(userData.notifications.length));
  });
});

router.post('/notifications/markAsRead', function(req, res, next) {
  User
  .findOne({_id:req.session._id})
  .exec((err, userData) => {
    userData.notifications = [];
    userData.save((err, response) => {
      res.redirect("/me/activity");
    });
  });
});

module.exports = router;
