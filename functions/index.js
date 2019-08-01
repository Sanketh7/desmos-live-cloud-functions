const functions = require('firebase-functions');

const admin = require('firebase-admin');

const {Storage} = require('@google-cloud/storage');
const gcs = new Storage();
const bucket = gcs.bucket("desmos-live-23326.appspot.com");

admin.initializeApp();


exports.getUIDFromEmail = functions.https.onCall(async (data, context) => {
    const otherEmail = data.email;

    return new Promise((resolve, reject) => {
        admin.database().ref('emailsToUser/').child(otherEmail).once('value', (data) => {
            resolve(data.val());
        });
    });      
});

exports.getEmailFromUID = functions.https.onCall(async (data, context) => {
    const otherUid = data.uid;

    return new Promise((resolve, reject) => {
        admin.database().ref('usersToEmail/').child(otherUid).once('value', (data) => {
            resolve(data.val());
        });
    }); 
});

exports.validateUID = functions.https.onCall(async (data, context) => {
    const uid = data.uid;

    return new Promise((resolve, reject) => {
        admin.database().ref('usersToEmail/'+uid).once('value', data => {
            if (data.exists()) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
});

exports.uploadImage = functions.https.onCall(async (data, context) => {
    const dataURL = data.dataURL;
    const uid = context.auth.uid; //data.uid;
    const fileNameData = data.fileName;

    if (!fileNameData || !dataURL || !uid) {
        return;
    }

    const mimeTypes = require('mimetypes');

    let image = dataURL,
        mimeType = image.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)[1],
        fileName = fileNameData + Date.now() + "." + mimeTypes.detectExtension(mimeType),
        base64EncodedImageString = image.replace(/^data:image\/\w+;base64,/, ''),
        imageBuffer = new Buffer(base64EncodedImageString, 'base64');

    let storageRef = bucket.file(uid+"/"+fileNameData+"/"+fileName);

    await new Promise((resolve, reject) => {
        storageRef.save(imageBuffer, {
            metadata: {contentType: mimeType},
            public: true,
            validation: 'md5'
        }, (error) => {
            resolve(0);
        })
    });

    let urlData = await new Promise((resolve, reject) => {
        const config = {
            action: 'read',
            expires: '03-17-2050'
        };

        storageRef.getSignedUrl(config, (err, url) => {
            if (err) {
                console.error(err);
                resolve(0);
            }

            console.log(url);
            resolve(url);
        });
    });

    return {url: urlData};
});

exports.validateEmail = functions.https.onCall(async (data, context) => {
    const email = data.email;
    
    return new Promise((resolve, reject) => {
        admin.database().ref('emailsToUser/'+email).once('value', (data) => {
            if (data.exists()) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
});

exports.linkUserToProject = functions.https.onCall((data, context) => {
    const ownerUid = data.ownerUid;
    const projectName = data.projectName;
    const otherUid = context.auth.uid; //data.otherUid;

    admin.database().ref('users/'+ownerUid+'/linkedTo/'+otherUid+'/').update({
        [projectName]: true
    });
});

exports.importFileFromAnotherUser = functions.https.onCall(async (data, context) => {
    const ownerUid = data.ownerUid; 
    const fileName = data.fileName;
    const myUid = context.auth.uid;

    return new Promise(async (resolve, reject) => {
        admin.database().ref('users/'+ownerUid+'/files/'+fileName+'/linked/'+myUid).once('value', (data) => {
            if (data.exists()) { // check if the file has even been shared with the user
                admin.database().ref('users/'+ownerUid+'/files/'+fileName+'/data/').once('value', fileData => {
                    resolve(fileData.val());
                });
            } else {
                resolve(-1);
            }
        })
    });
});

exports.updateFileFromAnotherUser = functions.https.onCall(async (data, context) => {
    const ownerUid = data.ownerUid;
    const fileName = data.fileName;
    const myUid = context.auth.uid;
    
    const content = data.content;

    admin.database().ref('users/'+ownerUid+'/files/'+fileName+'/linked/'+myUid).once('value', data => {
        if (data.exists()) {
            admin.database().ref('users/'+ownerUid+'/files/'+fileName).update({
                "data": content
            });
        }
    });
});