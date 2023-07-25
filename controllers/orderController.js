const Address = require("../models/adressModel");
const Cart = require('../models/cartModel');
const orderHelper = require('../helpers/orderHelper')
const couponHelper = require('../helpers/couponHelper')
const Order = require('../models/orderModel');
const {ObjectId} = require("mongodb");
const easyinvoice = require("easyinvoice");
const fs = require("fs");
const { Readable } = require('stream');
const path=require('path')


const checkOut = async (req,res)=>{
    try {
        const user = res.locals.user
        const total = await Cart.findOne({ user: user.id });
        const address = await Address.findOne({user:user._id}).lean().exec()
        
        const cart = await Cart.aggregate([
            {
              $match: { user: user.id }
            },
            {
              $unwind: "$cartItems"
            },
            {
              $lookup: {
                from: "products",
                localField: "cartItems.productId",
                foreignField: "_id",
                as: "carted"
              }
            },
            {
              $project: {
                item: "$cartItems.productId",
                quantity: "$cartItems.quantity",
                total: "$cartItems.total",
                carted: { $arrayElemAt: ["$carted", 0] }
              }
            }
          ]);
      if(address){
        res.render('checkOut',{address:address.addresses,cart,total}) 
      }else{
        res.render('checkOut',{address:[],cart,total})
      }
    } catch (error) {
        console.log(error.message) 
        
    }
}

const changePrimary = async (req, res) => {
    try {
      const userId = res.locals.user._id
      const result = req.body.addressRadio;
      console.log(result)
      const user = await Address.find({ user: userId.toString() });
  
      const addressIndex = user[0].addresses.findIndex((address) =>
        address._id.equals(result)
      );
      if (addressIndex === -1) {
        throw new Error("Address not found");
      }
  
      const removedAddress = user[0].addresses.splice(addressIndex, 1)[0];
      user[0].addresses.unshift(removedAddress);
  
      const final = await Address.updateOne(
        { user: userId },
        { $set: { addresses: user[0].addresses } }
      );
  
      res.redirect("/checkOut");
    } catch (error) {
      console.log(error.message);
    }
  };

  const postCheckOut  = async (req, res) => {
    
    try {
      console.log(req.body, "body");
      let userId = res.locals.user;
      let data = req.body;
      let total = data.total;
      const couponCode = data.couponCode
      await couponHelper.addCouponToUser(couponCode, userId);


      try {
        const response = await orderHelper.placeOrder(data,userId);
        console.log(response, "response");

        if (data.paymentOption === "cod") { 
          res.json({ codStatus: true });
          await Cart.deleteOne({ user:userId._id  })
        } 
          else if (data.paymentOption === "wallet") {
            res.json({ orderStatus: true, message: "order placed successfully" });
            await Cart.deleteOne({ user:userId._id  })

        }else if (data.paymentOption === "razorpay") {
          const order = await orderHelper.generateRazorpay(userId._id,data.total);
          console.log("ORDERRAZOR"+order);
          res.json(order); 
        }
       
      } catch (error) {
        console.log("got here ----");
        console.log({ error: error.message }, "22");
        res.json({ status: false, error: error.message });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  }

  // const orderList  = async(req,res)=>{
  //   try {
  //     const user  = res.locals.user
  //     const order = await Order.findOne({user:user._id})
  //     res.render('orderList',{order:order.orders})
  //   } catch (error) {
      
  //   }
  // }

  const orderList = async (req, res) => {
    try {
      const user = res.locals.user;
      const order = await Order.findOne({ user: user._id }).sort({ createdAt: -1 });
      // The "createdAt" field is assumed to represent the creation date of the order.
  
      res.render('orderList', { order: order.orders });
    } catch (error) {
      // Handle any potential errors
      console.log(error.message);
    }
  };
  

  const orderDetails = async (req,res)=>{
    try {
      const user = res.locals.user
      const id = req.query.id
      // console.log(id);
      orderHelper.findOrder(id, user._id).then((orders) => {
        const address = orders[0].shippingAddress
        const products = orders[0].productDetails 
        // console.log(products[0].productName)
        res.render('orderDetails',{orders,address,products})
      });    
    } catch (error) {
      console.log(error.message);
    }
  
  }

  const cancelOrder = async(req,res)=>{
    const orderId = req.body.orderId
    const status = req.body.status
    orderHelper.cancelOrder(orderId, status).then((response) => {
      // console.log(response);
      res.send(response);
    });
  
  
  }

  const verifyPayment =  (req, res) => {
    console.log("VERIFYPAYMENT",req.body);
  
    orderHelper.verifyPayment(req.body).then(() => {
      orderHelper
        .changePaymentStatus(res.locals.user._id, req.body.order.receipt)
        .then(() => {
          // console.log(req.body);
          res.json({ status: true });
        })
        .catch((err) => {
          res.json({ status: false });
        });
    }).catch((err)=>{
      console.log(err);
  
    });
  }

  const downloadInvoice = async (req, res) => {
    try {
      const id = req.query.id
      userId = res.locals.user._id;
  
      result = await orderHelper.findOrder(id, userId);
      console.log(result);
      const date = result[0].createdAt.toLocaleDateString();
      const product = result[0].productDetails;

  
      const order = {
        id: id,
        total:parseInt( result[0].totalPrice),
        date: date,
        payment: result[0].paymentMethod,
        name: result[0].shippingAddress.item.name,
        street: result[0].shippingAddress.item.address,
        locality: result[0].shippingAddress.item.locality,
        city: result[0].shippingAddress.item.city,
        state: result[0].shippingAddress.item.state,
        pincode: result[0].shippingAddress.item.pincode,
        product: result[0].productDetails,
      };
  
      const products = order.product.map((product) => ({
        "quantity":parseInt( product.quantity),
        "description": product.productName,
        "tax-rate":0,
        "price": parseInt(product.productPrice),
      }));
  
    
      var data = {
        customize: {},
        images: {
          // logo: "https://public.easyinvoice.cloud/img/logo_en_original.png",
  
          background: "https://public.easyinvoice.cloud/img/watermark-draft.jpg",
        },
  
  
        sender: {
          company: "URBANhues",
          address: "Brototype",
          zip: "686633",
          city: "Maradu",
          country: "India",
        },
  
        client: {
          company: order.name,
          address: order.street,
          zip: order.pincode,
          city: order.city,
          // state:" <%=order.state%>",
          country: "India",
        },
        information: {
          number: order.id,
  
          date: order.date,
          // Invoice due date
          "due-date": "Nil",
        },
  
        products: products,
        // The message you would like to display on the bottom of your invoice
        "bottom-notice": "Thank you,Keep shopping.",
      };
  
      easyinvoice.createInvoice(data, async function (result) {
        //The response will contain a base64 encoded PDF file
        await fs.writeFileSync("invoice.pdf", result.pdf, "base64");
  
  
         // Set the response headers for downloading the file
         res.setHeader('Content-Disposition', 'attachment; filename="invoice.pdf"');
         res.setHeader('Content-Type', 'application/pdf');
   
         // Create a readable stream from the PDF base64 string
         const pdfStream = new Readable();
         pdfStream.push(Buffer.from(result.pdf, 'base64'));
         pdfStream.push(null);
   
         // Pipe the stream to the response
         pdfStream.pipe(res);
  
        
      });
    } catch (error) {
      console.log(error.message);
    }
  };
  




  

module.exports = {
    checkOut,
    changePrimary,
    postCheckOut,
    orderDetails,
    orderList,
    cancelOrder,
    verifyPayment,
    downloadInvoice
}
