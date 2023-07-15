const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const axios = require("axios");
const Botly = require("botly");
const smser = require("./smser");
const search = require("./search");
const quote = require("./quotes");
const PageID = "108853885138709";
const port = process.env.PORT || 3000;
const botly = new Botly({
    accessToken: process.env.PAGE_ACCESS_TOKEN,
    verifyToken: process.env.VERIFY_TOKEN,
    webHookPath: process.env.WB_PATH,
    notificationType: Botly.CONST.REGULAR,
    FB_URL: "https://graph.facebook.com/v2.6/",
  });
/* ----- DB ----- */
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SB_URL, process.env.SB_KEY, { auth: { persistSession: false} });
/* ----- DB Qrs ----- */
async function createUser(user) {
  const { data, error } = await supabase
      .from('users')
      .insert([ user ]);

    if (error) {
      throw new Error('Error creating user : ', error);
    } else {
      return data
    }
};

async function updateUser(id, update) {
  const { data, error } = await supabase
    .from('users')
    .update( update )
    .eq('uid', id);

    if (error) {
      throw new Error('Error updating user : ', error);
    } else {
      return data
    }
};

async function userDb(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('uid', userId);

  if (error) {
    console.error('Error checking user:', error);
  } else {
    return data
  }
};

async function searcher(senderId, query, country, token, code) {
  var callapp = (qr) => {
    if (qr.startsWith("+")) {
      qr = qr.slice(1);
      return qr.replace(/\D/g, '');
    } else {
      return code + qr.replace(/\D/g, '');
    }
  };
    axios.get(`https://search5-noneu.truecaller.com/v2/bulk?q=${query}&countryCode=${country}&type=14&encoding=json`, { headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      }})
      .then(response => {
          if (response.data.data[0] != null) {
            if (response.data.data[0].value.name) {
              if (response.data.data[0].value.image) {
                botly.sendGeneric({
                  id: senderId,
                  elements: {
                    title: response.data.data[0].value.name,
                    image_url: response.data.data[0].value.image,
                    subtitle: `${response.data.data[0].value.phones[0].carrier} | ${response.data.data[0].value.phones[0].nationalFormat}`,
                    buttons: [
                      botly.createWebURLButton("WhatsApp 📞",`wa.me/${response.data.data[0].value.phones[0].e164Format}`),
                      botly.createPostbackButton("الإعدادات ⚙️", "profile")
                    ],
                  },
                  aspectRatio: Botly.CONST.IMAGE_ASPECT_RATIO.SQUARE,
                });
              } else {
                botly.sendGeneric({
                  id: senderId,
                  elements: {
                    title: response.data.data[0].value.name,
                    image_url: "https://i.ibb.co/StcT5v2/unphoto.jpg",
                    subtitle: `${response.data.data[0].value.phones[0].carrier} | ${response.data.data[0].value.phones[0].nationalFormat}`,
                    buttons: [
                      botly.createWebURLButton("WhatsApp 📞", `wa.me/${response.data.data[0].value.phones[0].e164Format}`),
                      botly.createPostbackButton("الإعدادات ⚙️", "profile"),
                    ],
                  },
                  aspectRatio: Botly.CONST.IMAGE_ASPECT_RATIO.SQUARE,
                });
              }
            } else {
              axios.get(`https://s.callapp.com/callapp-server/csrch?cpn=%2B${callapp(query)}&myp=fb.1122543675802814&ibs=3&cid=3&tk=0017356813&cvc=2038`)
              .then(response => {
                console.log("fincp")
                botly.sendGeneric({
                  id: senderId,
                  elements: {
                    title: response.data.name,
                    image_url: "https://i.ibb.co/StcT5v2/unphoto.jpg",
                    subtitle: `TBS | NDN`,
                    buttons: [
                      botly.createPostbackButton("الإعدادات ⚙️", "profile"),
                      botly.createPostbackButton("تسجيل برقم الهاتف 📱", "paid"),
                    ],
                  },
                  aspectRatio: Botly.CONST.IMAGE_ASPECT_RATIO.HORIZONTAL,
                });
              }, error => {
                botly.sendText({
                  id: senderId,
                  text: "لم يتم العثور على صاحب 👤 هذا الرقم 🙄",
                });
              });
            }
          } else {

            botly.sendText({
              id: senderId,
              text: "لم يتم العثور على صاحب 👤 هذا الرقم 🙄",
            });
          }
      }, async error => {
        if (error.response.data.status == 40101) {
          await updateUser(senderId, {token: null, phone: null, lastsms: null, smsid: null, smsed: false, mode: "free"})
                  .then((data, error) => {
                    if (error) {
                      console.log("DB-ERR : ", error);
                    }
                    console.log("PAID-CLN");
                    botly.sendText({ id: senderId, text: "تم إنهاء حسابك. المرجو استعمال رقم اخر. او الإكتفاء بالوضع المجاني" });
                  });
        } else {
          
        }
      });
}
app.get("/", function (_req, res) { res.sendStatus(200); });
app.use(bodyParser.json({ verify: botly.getVerifySignature(process.env.APP_SECRET)}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use("/webhook", botly.router());

botly.on("message", async (senderId, message) => {
  botly.sendText({ id: senderId, text: "يجري إصلاح الصفحة الان :) تمهل قليلا...." });
  /*
  const user = await userDb(senderId);
    const timer = new Date().getTime() + 24 * 60 * 60 * 1000;
    const time = new Date().getTime();
    if (message.message.text) {
      const nume = message.message.text.replace(/\D/g, "");
      const isnum = /^\d+$/.test(nume);
      if (message.message.text == "البروفيل") {
        if (user[0].mode == "free") {
          botly.sendButtons({
            id: senderId,
            text: `البلد الحالي 🌐 : ${user[0].country}\nنوع الحساب 💬 : ${user[0].mode}\nعمليات البحث 🔍 : (${user[0].searchnums}/10)`,
            buttons: [botly.createPostbackButton("تغيير البلد 🌐", "recountry")],
          });
        } else if (user[0].mode == "paid") {
          botly.sendButtons({
            id: senderId,
            text: `البلد الحالي 🌐 : ${user[0].country}\nنوع الحساب 💬 : ${user[0].mode}`,
            buttons: [
              botly.createPostbackButton("تغيير البلد 🌐", "recountry"),
              botly.createPostbackButton("حذف حسابي ❎", "delaccount"),
            ],
          });
        } else {
          botly.sendText({ id: senderId, text: "حسابك غير موجود اصلا" });
        }
      } else if (message.message.text == "com1") {
        //
      } else if (message.message.text == "com2") {
      //eval(search.searchPhone(senderId, user[0].country, "0663712471", user[0].searchnums));
      } else {
        if (user[0]) {
          if (user[0].country == null) {
            botly.sendText({
              id: senderId,
              text: "لم يتم إختيار البلد! الرجاء اختيار البلد الخاص بك 🌍",
              quick_replies: [
                botly.createQuickReply("الجزائر 🇩🇿", "dz"),
                botly.createQuickReply("المغرب 🇲🇦", "ma"),
                botly.createQuickReply("تونس 🇹🇳", "tn"),
                botly.createQuickReply("ليبيا 🇱🇾", "ly"),
                botly.createQuickReply("مصر 🇪🇬", "eg"),
                botly.createQuickReply("الاردن 🇯🇴", "jo"),
                botly.createQuickReply("السودان 🇸🇩", "sd"),
                botly.createQuickReply("سوريا 🇸🇾", "sy"),
                botly.createQuickReply("العراق 🇮🇶", "iq"),
                botly.createQuickReply("بولندا", "pl"),
                botly.createQuickReply("موريتانيا 🇲🇷", "mr"),
                botly.createQuickReply("قطر 🇶🇦", "qa"),
                botly.createQuickReply("اليمن 🇾🇪", "ye"),
              ],
            });
          } else if (user[0].mode == "free") {
            if (time < user[0].lastsearch) {
              if (user[0].searchnums >= 10) {
                botly.sendButtons({
                  id: senderId,
                  text: "انتهت عمليات البحث الخاصة بك ✋ يرجى الانتظار حتى غدا (24 ساعة ⏱️) او التسجيل برقم هاتفك للحصول على عدد غير محدود من عمليات البحث",
                  buttons: [
                    botly.createPostbackButton("تسجيل برقم الهاتف 📱", "paid"),
                  ],
                });
              } else {
                const add = user[0].searchnums + 1;
                if (isnum == true) {
                  await updateUser(senderId, {lastsearch: timer, searchnums: add})
                  .then((data, error) => {
                    if (error) {
                      botly.sendText({id: senderId, text: "حدث خطأ"});
                    }
                    eval(search.searchPhone(senderId, user[0].country, message.message.text, user[0].phonecode));
                  });
                } else {
                  botly.sendText({
                    id: senderId,
                    text: "يرجى إدخال أرقام هواتف فقط 😺 للبحث عنها.",
                  });
                }
              }
            } else if (time > user[0].lastsearch) {
              if (isnum == true) {
                await updateUser(senderId, {lastsearch: timer, searchnums: 1})
                  .then((data, error) => {
                    if (error) {
                      botly.sendText({id: senderId, text: "حدث خطأ"});
                    }
                    eval(search.searchPhone( senderId, user[0].country, message.message.text, user[0].phonecode ));
                  });
              } else {
                botly.sendText({
                  id: senderId,
                  text: "يرجى إدخال أرقام هواتف فقط 😺 للبحث عنها.",
                });
              }
            }
          } else if (user[0].mode == "paid") {
            if (user[0].token == null) {
              if (user[0].phone == null) {
                if (isnum == true) {
                  botly.sendButtons({
                    id: senderId,
                    text: `هل تؤكد أن هذا ${message.message.text} هو رقمك الصحيح ؟ 🤔`,
                    buttons: [
                      botly.createPostbackButton(
                        "نعم ✅",
                        `cn-${message.message.text}`
                      ),
                      botly.createPostbackButton("لا ❎", "rephone"),
                    ],
                  });
                } else {
                  botly.sendButtons({
                    id: senderId,
                    text: "لم يتم العثور على رقمك! المرجو كتابة رقم هاتفك الصحيح ✅😺",
                    buttons: [
                      botly.createPostbackButton("العودة للمجاني ⬇️", "free"),
                    ],
                  });
                }
              } else if (user[0].phone != null && user[0].smsid != null && user[0].smsed == true) {
                const time = new Date().getTime();
                if (time < user[0].lastsms) {
                  if (isnum == true && message.message.text.length == 6) {
                    eval(
                      smser.verifySMS(
                        senderId,
                        user[0].phone,
                        user[0].country,
                        user[0].phonecode,
                        user[0].smsid,
                        message.message.text
                      )
                    );
                  } else {
                    botly.sendButtons({
                      id: senderId,
                      text: "الرقم خاطئ ❎ قم بإدخال الرقم الصحيح المتكون من 6 أرقام ✅👌",
                      buttons: [
                        botly.createPostbackButton("العودة للمجاني ⬇️", "free"),
                      ],
                    });
                  }
                } else if (time > user[0].lastsms) {
                  await updateUser(senderId, {phone: null, smsid: null, lastsms: time, smsed: false})
                  .then((data, error) => {
                    if (error) {
                      botly.sendText({id: senderId, text: "حدث خطأ"});
                    }
                    botly.sendText({
                      id: senderId,
                      text: "انتهى وقت إدخال رقم التحقق 😓 الرجاء إدخال رقم هاتف اخر و اعادة المحاولة 🔄",
                    }); 
                  });
                }
              }
            } else {
              if (isnum == true) {
                searcher(
                  senderId,
                  message.message.text,
                  user[0].country,
                  user[0].token,
                  user[0].phonecode
                );
              } else {
                botly.sendText({
                  id: senderId,
                  text: "الرجاء إدخال ارقام هواتف فقط 🙄📲",
                });
              }
            }
          }
        } else {
          await createUser({uid: senderId, mode: "free", lastsearch: timer, searchnums: 0})
            .then((data, error) => {
              botly.sendText({
                id: senderId,
                text: "أهلا بك في كالربوت ✨🌙 يمكنك إدخال اي رقم هاتف 📞 و سأجلب لك إسمه. لكن عليك اولا إختيار بلدك 😊👇",
                quick_replies: [
                  botly.createQuickReply("الجزائر 🇩🇿", "dz"),
                  botly.createQuickReply("المغرب 🇲🇦", "ma"),
                  botly.createQuickReply("تونس 🇹🇳", "tn"),
                  botly.createQuickReply("ليبيا 🇱🇾", "ly"),
                  botly.createQuickReply("مصر 🇪🇬", "eg"),
                  botly.createQuickReply("الاردن 🇯🇴", "jo"),
                  botly.createQuickReply("السودان 🇸🇩", "sd"),
                  botly.createQuickReply("سوريا 🇸🇾", "sy"),
                  botly.createQuickReply("العراق 🇮🇶", "iq"),
                  botly.createQuickReply("بولندا", "pl"),
                  botly.createQuickReply("موريتانيا 🇲🇷", "mr"),
                  botly.createQuickReply("قطر 🇶🇦", "qa"),
                  botly.createQuickReply("اليمن 🇾🇪", "ye")
                ],
              });
            });
        }
      }
    } else if (message.message.attachments[0].payload.sticker_id) {
     // botly.sendText({ id: senderId, text: "(Y)" });
    } else if (message.message.attachments[0].type == "image") {
      botly.sendText({
        id: senderId,
        text: "للأسف. لا يمكنني البحث بالصور 📷🤔 يرجى استعمال الارقام فقط",
      });
    } else if (message.message.attachments[0].type == "audio") {
      botly.sendText({
        id: senderId,
        text: "أنا غير قادر على البحث بالصوت 🎙 المرجو استعمال ارقام الهواتف فقط",
      });
    } else if (message.message.attachments[0].type == "video") {
      botly.sendText({
        id: senderId,
        text: "لا. هذا فيديو! 😴🎥 لا يمكنني البحث بالفيديوهات. يرجى استعمال ارقام الهواتف فقط",
      });
    }
    //  e n d  //
    */
});

botly.on("postback", async (senderId, message, postback) => {
  /*
    // s t a r t  //
    const user = await userDb(senderId);
    const time = new Date().getTime();
    const timer = new Date().getTime() + 24 * 60 * 60 * 1000;
    if (user[0]) {
      if (message.postback) {
        // Normal (buttons)
        if (postback == "START") {
          if (user != null) {
            botly.sendText({
              id: senderId,
              text: "مرحبا بك مرة اخرى في كالربوت 😀💜",
            });
          } else {
            await createUser({uid: senderId, mode: "free", lastsearch: timer, searchnums: 0})
            .then((data, error) => {
              botly.sendText({
                id: senderId,
                text: "أهلا بك في كالربوت ✨🌙 يمكنك إدخال اي رقم هاتف 📞 و سأجلب لك إسمه. لكن عليك اولا إختيار بلدك 😊👇",
                quick_replies: [
                  botly.createQuickReply("الجزائر 🇩🇿", "dz"),
                  botly.createQuickReply("المغرب 🇲🇦", "ma"),
                  botly.createQuickReply("تونس 🇹🇳", "tn"),
                  botly.createQuickReply("ليبيا 🇱🇾", "ly"),
                  botly.createQuickReply("مصر 🇪🇬", "eg"),
                  botly.createQuickReply("الاردن 🇯🇴", "jo"),
                  botly.createQuickReply("السودان 🇸🇩", "sd"),
                  botly.createQuickReply("سوريا 🇸🇾", "sy"),
                  botly.createQuickReply("العراق 🇮🇶", "iq"),
                  botly.createQuickReply("بولندا", "pl"),
                  botly.createQuickReply("موريتانيا 🇲🇷", "mr"),
                  botly.createQuickReply("قطر 🇶🇦", "qa"),
                  botly.createQuickReply("اليمن 🇾🇪", "ye")
                ],
              });
            });
          }
        } else if (postback == "profile") {
          if (user[0].mode == "free") {
            botly.sendButtons({
              id: senderId,
              text: `البلد الحالي 🌐 : ${user[0].country}\nنوع الحساب 💬 : ${user[0].mode}\nعمليات البحث 🔍 : (${user[0].searchnums}/10)`,
              buttons: [botly.createPostbackButton("تغيير البلد 🌐", "recountry")],
            });
          } else if (user[0].mode == "paid") {
            botly.sendButtons({
              id: senderId,
              text: `البلد الحالي 🌐 : ${user[0].country}\nنوع الحساب 💬 : ${user[0].mode}`,
              buttons: [
                botly.createPostbackButton("تغيير البلد 🌐", "recountry"),
                botly.createPostbackButton("حذف حسابي ❎", "delaccount"),
              ],
            });
          }
        } else if (postback == "recountry") {
          botly.sendText({
            id: senderId,
            text: "يرجى إختيار البلد 🌐 الذي تريد التغيير له ☑️",
            quick_replies: [
              botly.createQuickReply("الجزائر 🇩🇿", "dz"),
              botly.createQuickReply("المغرب 🇲🇦", "ma"),
              botly.createQuickReply("تونس 🇹🇳", "tn"),
              botly.createQuickReply("ليبيا 🇱🇾", "ly"),
              botly.createQuickReply("مصر 🇪🇬", "eg"),
              botly.createQuickReply("الاردن 🇯🇴", "jo"),
              botly.createQuickReply("السودان 🇸🇩", "sd"),
              botly.createQuickReply("سوريا 🇸🇾", "sy"),
              botly.createQuickReply("العراق 🇮🇶", "iq"),
              botly.createQuickReply("السعودية 🇸🇦", "sa"),
              botly.createQuickReply("موريتانيا 🇲🇷", "mr"),
              botly.createQuickReply("قطر 🇶🇦", "qa"),
              botly.createQuickReply("اليمن 🇾🇪", "ye"),
            ],
          });
        } else if (postback.startsWith("cn-")) {
          const phone = postback.replace("cn-", "");
          eval(
            smser.sendSMS(
              senderId,
              phone,
              user[0].country,
              user[0].phonecode
            )
          );
        } else if (postback == "rephone") {
          botly.sendText({
            id: senderId,
            text: "حسنا 🆗 يرجى إدخال رقم هاتف اخر الان 🤔",
          });
        } else if (postback == "free") {
          await updateUser(senderId, {token: null, mode: postback})
          .then((data, error) => {
            if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
            botly.sendText({ id: senderId, text: "تم حفظ حسابك بنجاح ☑️" });
          });
        } else if (postback == "delaccount") {
          await updateUser(senderId, {token: null, phone: null, lastsms: null, smsid: null, smsed: false, mode: "free"})
          .then((data, error) => {
            if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
            botly.sendText({ id: senderId, text: "تم حذف حسابك بنجاح ☑️" });
          });
        } else if (postback == "paid") {
          await updateUser(senderId, {token: null, phone: null, lastsms: null, smsid: null, smsed: false, mode: postback})
          .then((data, error) => {
            if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
            botly.sendText({id: senderId, text: "تم حفظ حسابك بنجاح ☑️ الرجاء كتابة رقم هاتفك لكي تبدأ عملية التوثيق 💁‍♂️"});
          });
        } else if (postback == "tbs") {
          //
        } else if (postback == "OurBots") {
          botly.sendText({
            id: senderId,
            text: `مرحبا 👋\nيمكنك تجربة كل الصفحات التي أقدمها لكم 👇 إضغط على إسم أي صفحة للتعرف عليها و مراسلتها 💬 كل الصفحات تعود لصانع واحد و كل ماتراه أمامك يُصنع بكل حـ💜ـب و إهتمام في ليالي الارض الجزائرية.\n• ${quote.quotes()} •`,
            quick_replies: [
              botly.createQuickReply("كالربوت 📞", "callerbot"),
              botly.createQuickReply("شيربوت 🌙", "sharebot"),
              botly.createQuickReply("بوتباد 📖", "bottpad"),
              botly.createQuickReply("ترجمان 🌍", "torjman"),
              botly.createQuickReply("بوتيوب ↗️", "botube"),
              botly.createQuickReply("كيوبوت 🐱", "qbot"),
              botly.createQuickReply("سمسمي 🌞", "simsimi")
            ],
          });
        }
      } else {
        // Quick Reply
        if (message.message.text == "tbs") {
          //
        } else if (message.message.text == "tbs") {
          //
        } else if (postback == "dz") {
          await updateUser(senderId, {country: postback, phonecode: 213})
          .then((data, error) => {
            if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
            botly.sendText({
              id: senderId,
              text: "تم حفظ البلد بنجاح 🌐 يمكنك البحث الان. لا يوجد داعي لإضافة رمز الدولة امام الارقام 🙅🏻‍♂️ (+213/+212/+9).",
            });
          });
        } else if (postback == "ma") {
          await updateUser(senderId, {country: postback, phonecode: 212})
          .then((data, error) => {
            if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
            botly.sendText({
              id: senderId,
              text: "تم حفظ البلد بنجاح 🌐 يمكنك البحث الان. لا يوجد داعي لإضافة رمز الدولة امام الارقام 🙅🏻‍♂️ (+213/+212/+9).",
            });
          });
        } else if (postback == "tn") {
          await updateUser(senderId, {country: postback, phonecode: 216})
          .then((data, error) => {
            if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
            botly.sendText({
              id: senderId,
              text: "تم حفظ البلد بنجاح 🌐 يمكنك البحث الان. لا يوجد داعي لإضافة رمز الدولة امام الارقام 🙅🏻‍♂️ (+213/+212/+9).",
            });
          });
        } else if (postback == "ly") {
          await updateUser(senderId, {country: postback, phonecode: 218})
          .then((data, error) => {
            if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
            botly.sendText({
              id: senderId,
              text: "تم حفظ البلد بنجاح 🌐 يمكنك البحث الان. لا يوجد داعي لإضافة رمز الدولة امام الارقام 🙅🏻‍♂️ (+213/+212/+9).",
            });
          });
        } else if (postback == "eg") {
          await updateUser(senderId, {country: postback, phonecode: 20})
          .then((data, error) => {
            if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
            botly.sendText({
              id: senderId,
              text: "تم حفظ البلد بنجاح 🌐 يمكنك البحث الان. لا يوجد داعي لإضافة رمز الدولة امام الارقام 🙅🏻‍♂️ (+213/+212/+9).",
            });
          });
        } else if (postback == "jo") {
          await updateUser(senderId, {country: postback, phonecode: 962})
          .then((data, error) => {
            if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
            botly.sendText({
              id: senderId,
              text: "تم حفظ البلد بنجاح 🌐 يمكنك البحث الان. لا يوجد داعي لإضافة رمز الدولة امام الارقام 🙅🏻‍♂️ (+213/+212/+9).",
            });
          });
        } else if (postback == "sd") {
          await updateUser(senderId, {country: postback, phonecode: 249})
          .then((data, error) => {
            if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
            botly.sendText({
              id: senderId,
              text: "تم حفظ البلد بنجاح 🌐 يمكنك البحث الان. لا يوجد داعي لإضافة رمز الدولة امام الارقام 🙅🏻‍♂️ (+213/+212/+9).",
            });
          });
        } else if (postback == "sy") {
          await updateUser(senderId, {country: postback, phonecode: 963})
          .then((data, error) => {
            if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
            botly.sendText({
              id: senderId,
              text: "تم حفظ البلد بنجاح 🌐 يمكنك البحث الان. لا يوجد داعي لإضافة رمز الدولة امام الارقام 🙅🏻‍♂️ (+213/+212/+9).",
            });
          });
        } else if (postback == "iq") {
          await updateUser(senderId, {country: postback, phonecode: 964})
          .then((data, error) => {
            if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
            botly.sendText({
              id: senderId,
              text: "تم حفظ البلد بنجاح 🌐 يمكنك البحث الان. لا يوجد داعي لإضافة رمز الدولة امام الارقام 🙅🏻‍♂️ (+213/+212/+9).",
            });
          });
        } else if (postback == "sa") {
          await updateUser(senderId, {country: postback, phonecode: 966})
          .then((data, error) => {
            if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
            botly.sendText({
              id: senderId,
              text: "تم حفظ البلد بنجاح 🌐 يمكنك البحث الان. لا يوجد داعي لإضافة رمز الدولة امام الارقام 🙅🏻‍♂️ (+213/+212/+9).",
            });
          });
        } else if (postback == "mr") {
          await updateUser(senderId, {country: postback, phonecode: 222})
          .then((data, error) => {
            if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
            botly.sendText({
              id: senderId,
              text: "تم حفظ البلد بنجاح 🌐 يمكنك البحث الان. لا يوجد داعي لإضافة رمز الدولة امام الارقام 🙅🏻‍♂️ (+213/+212/+9).",
            });
          });
        } else if (postback == "qa") {
          await updateUser(senderId, {country: postback, phonecode: 974})
          .then((data, error) => {
            if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
            botly.sendText({
              id: senderId,
              text: "تم حفظ البلد بنجاح 🌐 يمكنك البحث الان. لا يوجد داعي لإضافة رمز الدولة امام الارقام 🙅🏻‍♂️ (+213/+212/+9).",
            });
          });
        } else if (postback == "ye") {
          await updateUser(senderId, {country: postback, phonecode: 967})
          .then((data, error) => {
            if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
            botly.sendText({
              id: senderId,
              text: "تم حفظ البلد بنجاح 🌐 يمكنك البحث الان. لا يوجد داعي لإضافة رمز الدولة امام الارقام 🙅🏻‍♂️ (+213/+212/+9).",
            });
          });
        } else if (postback == "callerbot") {
          botly.sendGeneric({
            id: senderId,
            elements: {
              title: "CallerBot - كالربوت",
              image_url: "https://i.ibb.co/gM5pKr4/gencallerbot.png",
              subtitle: "صفحة ترسل لها اي رقم هاتف و ستبحث لك عن صاحب هذا الرقم",
              buttons: [
                botly.createWebURLButton("على الماسنجر 💬", "m.me/CallerBot/"),
                botly.createWebURLButton(
                  "على الفيسبوك 🌐",
                  "facebook.com/CallerBot/"
                ),
                botly.createWebURLButton(
                  "حساب الصانع 🇩🇿",
                  "facebook.com/0xNoti/"
                ),
              ],
            },
            aspectRatio: Botly.CONST.IMAGE_ASPECT_RATIO.HORIZONTAL,
          });
        } else if (postback == "sharebot") {
          botly.sendGeneric({
            id: senderId,
            elements: {
              title: "ShareBot - شيربوت",
              image_url: "https://i.ibb.co/2nSB6xx/gensharebot.png",
              subtitle:
                "صفحة لتحميل الفيديوهات من التيك توك بدون علامة او الريلز و فيديوهات الفيسبوك",
              buttons: [
                botly.createWebURLButton("على الماسنجر 💬", "m.me/ShareBotApp/"),
                botly.createWebURLButton(
                  "على الفيسبوك 🌐",
                  "facebook.com/ShareBotApp/"
                ),
                botly.createWebURLButton(
                  "حساب الصانع 🇩🇿",
                  "facebook.com/0xNoti/"
                ),
              ],
            },
            aspectRatio: Botly.CONST.IMAGE_ASPECT_RATIO.HORIZONTAL,
          });
        } else if (postback == "bottpad") {
          botly.sendGeneric({
            id: senderId,
            elements: {
              title: "Bottpad - بوتباد",
              image_url: "https://i.ibb.co/RBQZbXG/genbottpad.png",
              subtitle:
                "صفحة تجلب لك روايات من واتباد و ترسلها لك لكي تقرأها على الفيسبوك",
              buttons: [
                botly.createWebURLButton("على الماسنجر 💬", "m.me/Bottpad/"),
                botly.createWebURLButton(
                  "على الفيسبوك 🌐",
                  "facebook.com/Bottpad/"
                ),
                botly.createWebURLButton(
                  "حساب الصانع 🇩🇿",
                  "facebook.com/0xNoti/"
                ),
              ],
            },
            aspectRatio: Botly.CONST.IMAGE_ASPECT_RATIO.HORIZONTAL,
          });
        } else if (postback == "torjman") {
          botly.sendGeneric({
            id: senderId,
            elements: {
              title: "Torjman - Translation Bot",
              image_url: "https://i.ibb.co/hCtJM06/gentorjman.png",
              subtitle:
                "صفحة ترجمة تدعم 13 لغة مختلفة تساعدك على ترجمة النصوص بشكل فوري",
              buttons: [
                botly.createWebURLButton("على الماسنجر 💬", "m.me/TorjmanBot/"),
                botly.createWebURLButton(
                  "على الفيسبوك 🌐",
                  "facebook.com/TorjmanBot/"
                ),
                botly.createWebURLButton(
                  "حساب الصانع 🇩🇿",
                  "facebook.com/0xNoti/"
                ),
              ],
            },
            aspectRatio: Botly.CONST.IMAGE_ASPECT_RATIO.HORIZONTAL,
          });
        } else if (postback == "botube") {
          botly.sendGeneric({
            id: senderId,
            elements: {
              title: "Botube - بوتيوب",
              image_url: "https://i.ibb.co/jvt0t0B/genbotube.png",
              subtitle:
                "صفحة تبحث بها على اليوتيوب و ترسل لك فيديوهات يمكنك مشاهدتها و الاستماع لها",
              buttons: [
                botly.createWebURLButton("على الماسنجر 💬", "m.me/BotubeApp/"),
                botly.createWebURLButton(
                  "على الفيسبوك 🌐",
                  "facebook.com/BotubeApp/"
                ),
                botly.createWebURLButton(
                  "حساب الصانع 🇩🇿",
                  "facebook.com/0xNoti/"
                ),
              ],
            },
            aspectRatio: Botly.CONST.IMAGE_ASPECT_RATIO.HORIZONTAL,
          });
        } else if (postback == "qbot") {
          botly.sendGeneric({
            id: senderId,
            elements: {
              title: "كيوبوت - QBot",
              image_url: "https://i.ibb.co/Fx7kGFj/genqbot.png",
              subtitle:
                "صفحة يمكنك التحدث لها مثل الانسان بكل حرية و مناقشة معاها المواضيع التي تريدها",
              buttons: [
                botly.createWebURLButton("على الماسنجر 💬", "m.me/QBotAI/"),
                botly.createWebURLButton("على الفيسبوك 🌐", "facebook.com/QBotAI/"),
                botly.createWebURLButton(
                  "حساب الصانع 🇩🇿",
                  "facebook.com/0xNoti/"
                ),
              ],
            },
            aspectRatio: Botly.CONST.IMAGE_ASPECT_RATIO.HORIZONTAL,
          });
        } else if (postback == "simsimi") {
          botly.sendGeneric({
            id: senderId,
            elements: {
              title: "سمسمي الجزائري - Simsimi Algerian",
              image_url: "https://i.ibb.co/DkdLSSG/gensimsimi.png",
              subtitle:
                "صفحة للمرح فقط تقوم بالرد على رسائلك بشكل طريف تتحدث باللهجة الجزائرية فقط",
              buttons: [
                botly.createWebURLButton(
                  "على الماسنجر 💬",
                  "m.me/SimsimiAlgerian/"
                ),
                botly.createWebURLButton(
                  "على الفيسبوك 🌐",
                  "facebook.com/SimsimiAlgerian/"
                ),
                botly.createWebURLButton(
                  "حساب الصانع 🇩🇿",
                  "facebook.com/0xNoti/"
                ),
              ],
            },
            aspectRatio: Botly.CONST.IMAGE_ASPECT_RATIO.HORIZONTAL,
          });
        }
      }
    } else {
      await createUser({uid: senderId, mode: "free", lastsearch: timer, searchnums: 0})
            .then((data, error) => {
              botly.sendText({
                id: senderId,
                text: "أهلا بك في كالربوت ✨🌙 يمكنك إدخال اي رقم هاتف 📞 و سأجلب لك إسمه. لكن عليك اولا إختيار بلدك 😊👇",
                quick_replies: [
                  botly.createQuickReply("الجزائر 🇩🇿", "dz"),
                  botly.createQuickReply("المغرب 🇲🇦", "ma"),
                  botly.createQuickReply("تونس 🇹🇳", "tn"),
                  botly.createQuickReply("ليبيا 🇱🇾", "ly"),
                  botly.createQuickReply("مصر 🇪🇬", "eg"),
                  botly.createQuickReply("الاردن 🇯🇴", "jo"),
                  botly.createQuickReply("السودان 🇸🇩", "sd"),
                  botly.createQuickReply("سوريا 🇸🇾", "sy"),
                  botly.createQuickReply("العراق 🇮🇶", "iq"),
                  botly.createQuickReply("بولندا", "pl"),
                  botly.createQuickReply("موريتانيا 🇲🇷", "mr"),
                  botly.createQuickReply("قطر 🇶🇦", "qa"),
                  botly.createQuickReply("اليمن 🇾🇪", "ye")
                ],
              });
            });
    }
    //   e n d   //
    */
  });
  /*------------- RESP -------------*/
  /*
  botly.setGetStarted({pageId: PageID, payload: "START"});
  botly.setGreetingText({
      pageId: PageID,
      greeting: [
        {
          locale: "default",
          text: "tbs"
        },
        {
          locale: "ar_AR",
          text: "tbs"
        }
      ]
    });
  botly.setPersistentMenu({
      pageId: PageID,
      menu: [
          { 
            locale: "default",
            composer_input_disabled: false,
            call_to_actions: [
              {
                title:   "تعرف على بوتات أخرى 🤖",
                type:    "postback",
                payload: "OurBots"
              },{
                title:   "البروفايل 📁",
                type:    "postback",
                payload: "profile"
              },{
                type:  "web_url",
                title: "صنع بكل حـ❤️ـب في الجزائر",
                url:   "m.me/100011041393904/",
                webview_height_ratio: "full"
              }
            ]
          }
        ]
    });
    */
  /*------------- RESP -------------*/
app.listen(port, () => console.log(`App is on Port : ${port}`));