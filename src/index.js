// require('dotenv').config({path: './env'})
import dotenv from 'dotenv'
import connectDB from './db/index.js';
import { app } from './app.js';

dotenv.config({
    path: './env'
})

connectDB()
.then(()=>{

    app.on('error', (error)=>{
        console.log(`Error: ${error}`)
    })

    app.listen(process.env.PORT || 8000 , ()=>{
        console.log(`Server is running at PORT ${process.env.PORT}`)
    })
})
.catch((error)=>{
    console.log("MongoDb Connection Failed !!!", error)
})

/* 

import express from 'express';
const app=express()


(async ()=>{
    try
    {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on('error', (err)=>{
            console.log(`Error: ${err}`)
            throw err
        })

        app.listen(process.env.PORT, () => {
            console.log(`App listening on port ${process.env.PORT}`);
        });
    }
    catch(err) {
        console.log(`Error: ${err}`)
        throw err
    }
})()

*/