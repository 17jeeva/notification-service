 const express=require('express');
 const nodemailer=require('nodemailer')
 require('dotenv').config();

 const app=express()
 app.use(express.json())

 let primaryRetries=0;
 const maxRetries=3;

 //primary email transporter

 const primaryTransporter=nodemailer.createTransport({
    host:process.env.PRIMARY_HOST,
    port:process.env.PRIMARY_PORT,

    auth:{
        user:process.env.PRIMARY_USER,
        pass:process.env.PRIMARY_PASS
    }

 });

 //backup email transporter

 const backupTransporter=nodemailer.createTransport({
    host:process.env.BACKUP_HOST,
    port:process.env.BACKUP_PORT,

    auth:{
        user:process.env.BACKUP_USER,
        pass:process.env.BACKUP_PASS
    }
 });


 const sendEmail=(transporter,mailOptions)=>{
    return new Promise((resolve,reject)=>{
        transporter.sendMail(mailOptions,(error,info)=>{
             if(error){
                return reject(error)
             }
             else{
                return resolve(info)
             }
        });
    });

 };

 const trySendEmail=(mailOptions)=>{
    return sendEmail(primaryTransporter,mailOptions)
    .catch((error)=>{
        console.log(`primary service failed (attempt ${primaryRetries + 1}):`,error.message);
        primaryRetries += 1;

        if (primaryRetries < maxRetries) {

            return trySendEmail(mailOptions);
        }
        else{
            console.log('switching to backup service');
            return sendEmail(backupTransporter,mailOptions)
            
        }
        
    });
 }

 app.post('/send-email', (req,res)=>{
    const {to , subject,text}=req.body;

    if(!to || !subject || !text){
        return res.status(400).json({error: 'Missing required fiels'});
    }

    const mailOptions={

        from:process.env.SENDER_EMAIL,
        to,
        subject,
        text


    };

    primaryRetries=0; // reset tetries for each request

    trySendEmail(mailOptions)
    .then(info => res.status(200).json({message: "Email sent",info}))
    .catch(error => res.status(500).json({error: 'Failed to send email', details:error.message}))
 })

 const port=process.env.PRIMARY_PORT
 app.listen(port,()=>console.log('server is running'));
 