import { asyncHandler } from '../utils/asyncHanndler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const generateAccessAndRefreshTokens = async (userId)=>{
   try{
      const user = await User.findById(userId)

      const accessToken = user.generateAccessToken();
      const refreshToken = user.generateRefreshToken();

      
      user.refreshToken=refreshToken;
      
      await user.save({validateBeforeSave: false})

      // console.log('check :'+accessToken +" again: "+ refreshToken)
      
      return {accessToken, refreshToken};
   }
   catch(error){
      throw new ApiError(500, 'something went wrong while generating refresh and access token')
   }
}

// controller for register user 
const registerUser=asyncHandler(async (req, res)=>{
   
   // get user details form the frontend
   // validation not empty
   // check if user already exist: username email
   // check for the image, check for avatar
   // upload them to cloudinary, avatar
   // create user object - create entry in db
   // remove password and refresh token field form the response
   // check for the user creation
   // return response 

   const {fullName, email, username, password} = req.body;
   console.log(fullName, email, username, password)


   if([fullName, email, username, password].some((field)=>field?.trim()==="")) {
      throw new ApiError(400, "All fields are required");
   }

   const existedUser=await User.findOne({
      $or: [{username}, {password}]
   })

   if(existedUser) {
      throw new ApiError(409, "User with email or username already exist")
   }

   console.log(req.files)

   const avatarLocalPath = req.files?.avatar[0]?.path;


   if(!avatarLocalPath) {
      throw new ApiError(400, "Avatar File is required")
   }

   let coverImageLocalPath;
   if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0) {
      coverImageLocalPath = req.files.coverImage[0].path;
   }

   const avatar=await uploadOnCloudinary(avatarLocalPath);
   const coverImage = await uploadOnCloudinary(coverImageLocalPath);

   if(!avatar){
      throw new ApiError(400, "Avatar File is required")
   }

   const user = await User.create({
      fullName,
      avatar: avatar.url,
      coverImage: coverImage?.url || "",
      email,
      password,
      username: username.toLowerCase()
   })

   const createdUser = await User.findById(user._id).select("-password -refreshToken");

   if(!createdUser) {
      throw new ApiError(500, "Something went wrong while registering the user")
   }

   return res.status(201).json(
      new ApiResponse(200, createdUser, 'User registered successfully')
   )

});

// controller for login user 
const loginUser=asyncHandler(async (req, res)=>{
   // data from req.body 
   // username or email 
   // find the user
   // password check 
   // access and refresh token 
   // send cookie

   const {username, email, password}=req.body;

   console.log(req.body)

   if(!username && !email) {
      throw new ApiError(400, "username or email is required");
   }

   const user = await User.findOne({
      $or: [{username}, {email}]
   });

   if(!user) {
      throw new ApiError(400, "username doesn't exist")
   }

   const isPasswordValid = await user.isPasswordCorrect(password)


   if(!isPasswordValid) {
      throw new ApiError(401, "invalid user credentials")
   }

   const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

   console.log(accessToken, refreshToken)

   const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

   const options={
      httpOnly: true,
      secure: true
   }

   return res
   .status(200)
   .cookie("accessToken", accessToken, options)
   .cookie("refreshToken", refreshToken, options)
   .json(
      new ApiResponse(
         200,
         {
            user: loggedInUser,
            refreshToken,
            accessToken,
         },
         "user logged in successfully"
      )
   )

});

// controller for logout user 
const logoutUser=asyncHandler(async (req, res)=>{
   console.log('logout hit')
   console.log(req.user)
   const updatedUser=await User.findOneAndUpdate(
      req.user._id,
      {
         $unset: {
            refreshToken: 1 // this removes fields from the document
         }
      },
      {
         new: true
      }
   )

   console.log("updated user")
   console.log(updatedUser)

   const options = {
      httpOnly: true,
      secure: true
   }

   return res
   .status(200)
   .clearCookie("accessToken")
   .clearCookie("refreshToken")
   .json(new ApiResponse(200, {}, "User logged out"))

});

// controller for refreshing the access token 
const refreshAccessToken=asyncHandler(async (req, res)=>{
   try {
      const incomingRefreshToken=req.cookies.refreshToken || req.body.refreshToken;
   
      if(!incomingRefreshToken) {
         throw new ApiError(401, "Unauthorized request")
      }
   
      const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
   
      const user = await User.findById(decodedToken?._id)
   
      if(!user) {
         throw new ApiError(401, "Invalid refresh token")
      }
   
      if(incomingRefreshToken !== user?.refreshToken) {
         throw new ApiError(401, "Refresh token is expired or used")
      }
   
      const options={
         httpOnly: true,
         secure: true
      }
   
      const {accessToken, refreshToken}=await generateAccessAndRefreshTokens(user._id);
   
      console.log(accessToken, refreshToken)

      return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
         new ApiResponse(
            200,
            {
               accessToken: accessToken,
               refreshToken: refreshToken,
            },
            "Access token refresh"
         )
      )
   } catch (error) {
      throw new ApiError(500, error?.message || "Invalid refresh token")
   }


});

//controller for the change current password
const changeCurrentPassword = asyncHandler(async (req, res)=>{
   // console.log("documet form frint end "+req.body.oldPassword)
   const {oldPassword, newPassword} =  req.body;


   const user = await User.findById(req.user?._id);
   const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

   if(!isPasswordCorrect) {
      throw new ApiError(400, 'Invalid old password')
   }

   user.password=newPassword;
   await user.save({validateBeforeSave: false});

   return res
   .status(200)
   .json(
      new ApiResponse(200, {}, "password changed successfully")
   )

});

// controller for the get current user
const getCurrentUser = asyncHandler(async (req, res)=>{
   return res
   .status(200)
   .json(
      new ApiResponse(200, req.user, 'current user fetched successfully')
   )
});

//controller for the update account details
const updateAccountDetails = asyncHandler(async (req, res)=>{
   const {fullName, email} = req.body;
   
   
   if(!fullName || !email) {
      throw new ApiError(400, "All fields are required")
   }
   
   const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
         $set: {
            fullName,
            email
         }
      },
      {new: true}
   ).select("-password")

   console.log(fullName, email, user)
   
   return res 
   .status(200)
   .json(
      new ApiResponse(200, user, 'account details updated successfully')
   )
});

//controller for the update user avatar
const updateUserAvatar = asyncHandler(async (req, res)=>{
   const avatarLocalPath = req.file?.path;

   if(!avatarLocalPath){
      throw new ApiError(400, "Avatar file is missing")
   }

   const avatar = await uploadOnCloudinary(avatarLocalPath);

   if(!avatar.url) {
      throw new ApiError(400, 'failed to upload the avatar')
   }
   
   const user = await User.findByIdAndUpdate(
      req.user._id,
      {
         $set: {
            avatar: avatar.url
         }
      },
      {new: true}
   ).select("-password")


   return res 
   .status(200)
   .json(
      new ApiResponse(200, user, "Avatar image updated successfully")
   )

});

// controller for updating the user cover image  
const updateUserCoverImage=asyncHandler(async (req, res)=>{
   const coverImageLocalPath = req.file?.path
   if(!coverImageLocalPath){
      throw new ApiError(400, "Cover image not found")
   }

   const coverImage = await uploadOnCloudinary(coverImageLocalPath)
   if(!coverImage.url) {
      throw new ApiError(400, 'Error while uploading the cover image')
   }

   const user = await User.findByIdAndUpdate(
      req.user._id,
      {
         $set: {
            coverImage: coverImage.url
         }
      },
      {new: true}
   ).select("-password")

   return res 
   .status(200)
   .json(
      new ApiResponse(200, user, "Cover image updated successfully")
   )

});


// controller for get user channel profile
const getUserChannelProfile = asyncHandler(async (req, res)=>{
   // const {username}=req.body || req.params.username;
   const {username}=req.params;

   console.log(req.body, req.params)

   if(!username?.trim()) {
      throw new ApiError(400, 'username is missing')
   }

   const channel = await User.aggregate([
      {
         $match: {
            username: username?.toLowerCase()
         }
      },
      {
         $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "channel",
            as: "subscribers"
         }
      },
      {
         $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "subscriber",
            as: "subscribedTo"
         }
      },
      {
         $addFields: {
            subscribersCount: {
               $size: "$subscribers"
            },
            channelSubscribedToCount: {
               $size: "$subscribedTo"
            },
            isSubscribed: {
               $cond: {
                  if: {$in: [req.user?._id, "$subscribedTo"]},
                  then: true,
                  else: false
               }
            }
         }
      },
      {
         $project: {
            fullName: 1,
            username: 1,
            subscribersCount: 1,
            channelSubscribedToCount: 1,
            isSubscribed: 1,
            avatar: 1,
            coverImage: 1,
            email: 1
         }
      }
   ]);

   if(!channel?.length){
      throw new ApiError(404, "Channel does not exists")
   }

   return res 
   .status(200)
   .json(
      new ApiResponse(200, channel[0], 'User channel fatched successfully')
   )

});

// controller for get watch history
const getWatchHistory = asyncHandler(async (req, res)=>{
   
   const user = await User.aggregate([
      {
         $match: {
            _id: new mongoose.Types.ObjectId(req.user?._id)
         }
      },
      {
         $lookup: {
            from: "videos",
            localField: "watchHistory",
            foreignField: "_id",
            as: "watchHistory",
            pipeline: [
               {
                  $lookup: {
                     from: "users",
                     localField: "owner",
                     foreignField: "_id",
                     as: "owner",
                     pipeline: [
                        {
                           $project: {
                              fullName: 1,
                              username: 1,
                              avatar: 1
                           }
                        }
                     ]
                  }
               },
               {
                  $addFields: {
                     owner: {
                        $first: "$owner"
                     }
                  }
               }
            ]
         }
      }
   ])

   return res
   .status(200)
   .json(
      new ApiResponse(200, user[0].watchHostory, 'Watch history fetched successfully')
   )

});

export {
   registerUser, 
   loginUser, 
   logoutUser, 
   refreshAccessToken, 
   changeCurrentPassword, 
   getCurrentUser,
   updateAccountDetails,
   updateUserAvatar,
   updateUserCoverImage,
   getUserChannelProfile,
   getWatchHistory
}