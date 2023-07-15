const Botly = require("botly");
const axios = require("axios");
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
/* ----- DB ----- */

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

async function getTokens() {
  const { data, error } = await supabase
  .from('users')
  .select('*')
  .neq("token", null)
  if (error) {
    console.error('Error checking user:', error);
  } else {
    return data
  }
};

const searchPhone = async (senderId, country, query, code) => {
  var callapp = (qr) => {
    if (qr.startsWith("+")) {
      qr = qr.slice(1);
      return qr.replace(/\D/g, '');
    } else {
      return code + qr.replace(/\D/g, '');
    }
  };
  var tokens = await getTokens();
  var random = Math.floor(Math.random() * tokens.length);
  var research = function (token, key) {
    axios.get(`https://search5-noneu.truecaller.com/v2/bulk?q=${query}&countryCode=${country}&type=14&encoding=json`, {
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
        })
      .then((response) => {
          if (response.data.data[0]) {
            if (response.data.data[0].value.name) {
              botly.sendGeneric({
                id: senderId,
                elements: {
                  title: response.data.data[0].value.name,
                  image_url: "https://i.ibb.co/VTXKnYJ/gardencallerbot.png",
                  subtitle: `${response.data.data[0].value.phones[0].carrier} | ${response.data.data[0].value.phones[0].nationalFormat}`,
                  buttons: [
                    botly.createPostbackButton("الإعدادات ⚙️", "profile"),
                    botly.createPostbackButton("تسجيل برقم الهاتف 📱", "paid"),
                  ],
                },
                aspectRatio: Botly.CONST.IMAGE_ASPECT_RATIO.HORIZONTAL,
              });
            } else {
              axios.get(`https://s.callapp.com/callapp-server/csrch?cpn=%2B${callapp(query)}&myp=fb.1122543675802814&ibs=3&cid=3&tk=0017356813&cvc=2038`)
              .then(response => {
                console.log("fincp")
                botly.sendGeneric({
                  id: senderId,
                  elements: {
                    title: response.data.name,
                    image_url: "https://i.ibb.co/VTXKnYJ/gardencallerbot.png",
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
            axios.get(`https://s.callapp.com/callapp-server/csrch?cpn=%2B${callapp(query)}&myp=fb.1122543675802814&ibs=3&cid=3&tk=0017356813&cvc=2038`)
              .then(response => {
                console.log("fincp")
                botly.sendGeneric({
                  id: senderId,
                  elements: {
                    title: response.data.name,
                    image_url: "https://i.ibb.co/VTXKnYJ/gardencallerbot.png",
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
        },
        async (error) => {
          const retry = async () => {
            var retokens = await getTokens();
            var rerandom = Math.floor(Math.random() * retokens.length);
            research(retokens[rerandom].token, retokens[rerandom].uid);
          };
          if (error.response.data.status == 40101) {
            await updateUser(key, {token: null, phone: null, lastsms: null, smsid: null, smsed: false, mode: "free"})
                  .then((data, error) => {
                    if (error) {
                      console.log("DB-ERR : ", error);
                    }
                    console.log("DB-CLN");
                    retry();
                  });
          } else {
            retry();
          }
        });
      };
      research(tokens[random].token, tokens[random].uid);
    };
exports.searchPhone = searchPhone;
