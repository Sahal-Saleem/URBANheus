const { response } = require('express');
const cartModel = require('../models/cartModel');
const Cart = require('../models/cartModel');
const { resolve } = require('path');
const Product = require('../models/productModel')



// async function cartTotalfind (userId){
//   const cart = await Cart.findOne({user:userId})
//   let cartTotals = 0
//   for (let i = 0; i < cart.cartItems.length; i++) {
//     cartTotals += cart.cartItems[i].total;
//   }
//   return cartTotals
// }


const addCart = async (productId,userId)=>{
  const product = await Product.findOne({_id:productId})
    let productObj = {
        productId:productId,
        quantity:1,
        total:product.price
    }
    console.log(productObj)

    try {
        return new Promise((resolve,reject)=>{ 
            Cart.findOne({user:userId}).then(async(cart)=>{
                if(cart){
                    let productExist = await Cart.findOne({ user:userId,"cartItems.productId": productId });
                    if(productExist){
                        Cart.updateOne(
                            {user:userId,"cartItems.productId":productId},{
                                $inc:{"cartItems.$.quantity":1,
                                "cartItems.$.total":product.price
                              },
                              $set:{
                                cartTotal:cart.cartTotal+product.price
                              }
                            }
                        ).then((response)=>{
                            resolve({ response, status: false });

                        })
                    
                    }else{
                      console.log("new Product")
                        Cart.updateOne(
                            {user:userId},{$push:{cartItems:productObj},
                          $inc:{cartTotal:product.price}
                          }
                        ).then((response)=>{
                            resolve({status:true});
                        })

                    }
                }else{
                    let newCart = await Cart({
                        user:userId,
                        cartItems:productObj,
                        cartTotal:product.price
                    })
                    await newCart.save().then((response)=>{
                        resolve({status:true})
                    })
                }
                
            })
        })
        
    } catch (error) {
        console.log(error.message)
        
    }
}
const updateQuantity = async(data) => {
    let cartId = data.cartId;
    let proId = data.proId;
    let userId = data.userId;
    let count = data.count;
    let quantity = data.quantity;
    // const cart = await Cart.findOne({user:userId})
    const product = await Product.findOne({_id:proId})

    try {
      return new Promise(async (resolve, reject) => {
        if (count == -1 && quantity == 1) {
          // Cart.updateOne(
          //   { _id: cartId,"cartItems.productId": proId },
           
          //   {
          //     $pull: { cartItems: { productId: proId } }
          //   }
          // )
          Cart.findOneAndUpdate(
            { _id: cartId, "cartItems.productId": proId },
            {
              $pull: { cartItems: { productId: proId } },
              $inc: {cartTotal:product.price * count } // Increment the "itemCount" field by 1
            },
            { new: true } // Return the updated document after the update
          )
          
          .then(() => { 
            resolve({ status: true });
          });
        } else {
          Cart.updateOne(
            { _id: cartId, "cartItems.productId": proId },
            {
              $inc: { "cartItems.$.quantity": count ,
              "cartItems.$.total":product.price*count,
              cartTotal:product.price * count
            },
            }

          )
      
          
        .then(() => {
            Cart.findOne(
              { _id: cartId, "cartItems.productId": proId },
              { "cartItems.$": 1,cartTotal:1 }
            ).then((cart) => { 
              const newQuantity = cart.cartItems[0].quantity;
              const newSubTotal = cart.cartItems[0].total;
              const cartTotal = cart.cartTotal
              resolve({ status: true, newQuantity: newQuantity,newSubTotal:newSubTotal,cartTotal:cartTotal});
            });
          }); 
        }
      });
    } catch (error) {
      console.log(error.message);
    }
  }
  const getCartCount = (userId) => {
    return new Promise((resolve, reject) => {
      let count = 0;
      Cart.findOne({ user: userId }).then((cart) => {
        if (cart) {
          count = cart.cartItems.length;
        }
        resolve(count);
      });
    });
  }

  const deleteProduct =  async (data) => {
    let cartId = data.cartId;
    let proId = data.proId;
    const product = await Product.findOne({_id:proId})
    const cart = await Cart.findOne({ _id: cartId, "cartItems.productId": data.proId });
    
    return new Promise((resolve, reject) => {
      try {
        
        const cartItem = cart.cartItems.find(item => item.productId.equals(data.proId));
        const quantityToRemove = cartItem.quantity;
        Cart.updateOne( 
          { _id: cartId ,"cartItems.productId":proId},
          { $inc: {cartTotal: product.price* quantityToRemove * -1 },
          $pull: { cartItems: { productId: proId } },
           }
        ).then(() => {
          resolve({ status: true });
        });
      } catch (error) { 
        throw error;
      }
    });
  }

  // const getSubTotal = (userId)=>{
  //   try {
  //     return new Promise((resolve, reject) => {
  //       Cart.aggregate([
  //         {
  //           $match: {
  //             user:userId,
  //           },
  //         },
  //         {
  //           $unwind: "$cartItems",
  //         },
  //         {
  //           $project: {
  //             item: "$cartItems.productId",
  //             quantity: "$cartItems.quantity",
  //           },
  //         },
  //         {
  //           $lookup: {
  //             from: "products",
  //             localField: "item",
  //             foreignField: "_id",
  //             as: "carted",
  //           },
  //         },
  //         {
  //           $project: {
  //             item: 1,
  //             quantity: 1,

  //             price: {
  //               $arrayElemAt: ["$carted.price", 0],
  //             },
  //           },
  //         },
  //         {
  //           $project: {
  //             total: { $multiply: ["$quantity", "$price"] },
  //           },
  //         },
  //       ]).then((total) => {
  //         const totals = total.map((obj) => obj.total);

  //         resolve({ total, totals });
  //       });
  //     });
  //     console.log(Cart.user+':'+':'+userId)
  //   } catch (error) {
  //     console.log(error.message);
  //   }
  // }

 
            


  
 module.exports ={
    addCart,
    updateQuantity,
    getCartCount,
    deleteProduct,
    // getSubTotal,
 }