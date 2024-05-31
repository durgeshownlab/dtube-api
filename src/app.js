import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

const app=express();

// for configuring the server for cross origin resource sharing
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

// for allowing out server to accept the json data 
app.use(express.json({
    limit: '16kb'
}))

// for url encoding
app.use(express.urlencoded({
    extended: true
}))

// for locating the public directory to acccess the files and images
app.use(express.static("public"))

// for confifuring the cookie parser in the server 
app.use(cookieParser())



export { app }