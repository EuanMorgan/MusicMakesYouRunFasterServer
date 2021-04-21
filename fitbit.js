require("dotenv").config();
const axios = require("axios");
const { db, admin } = require("./firebase.js");
const tcx = require("./tcx.js");
//BEFORE DEPLOY:
// let redirect_uri =
//   "https://europe-west2-musicmakesyourunfaster.cloudfunctions.net/app/api/fitbit/user-auth";
//change redirect uri based on environment
let redirect_uri = process.env.FUNCTIONS_EMULATOR
  ? "http://localhost:3000/fitbit"
  : "https://musicmakesyourunfaster.firebaseapp.com/fitbit";
// let redirect_uri = "http://localhost:3000/fitbit";
let data_limit = 100;
const fitbitGetAccessToken = async (code) => {
  //step two: exchange code for access token
  try {
    //console.log("Getting token");
    let res = await axios({
      method: "POST",
      url: "https://api.fitbit.com/oauth2/token",
      headers: {
        Authorization: `Basic ${process.env.FITBIT_BASIC}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      params: {
        client_id: process.env.FITBIT_CLIENT_ID,
        grant_type: "authorization_code",
        redirect_uri: redirect_uri,
        code: code,
      },
    });
    // //console.log(res["data"]);
    let id = res["data"]["user_id"];
    access_token = res["data"]["access_token"];
    //console.log("Got access token: ", access_token);
    //console.log("Getting user data");
    let user_data = await axios({
      method: "GET",
      url: `https://api.fitbit.com/1/user/${id}/profile.json`,
      headers: { Authorization: `Bearer ${access_token}` },
    });
    //console.log("Got user data...");
    let final_response = {
      user_name: user_data.data.user.displayName,
      profile_pic_url: user_data.data.user.avatar640,
      refresh_token: res["data"]["refresh_token"],
    };

    //console.log("user data: ", final_response);
    //console.log("adding to database");

    await db.collection("users").doc(id).set(
      {
        fitbit: final_response,
      },
      { merge: true }
    );
    //console.log("Added user to database");
    let custom_token = await admin.auth().createCustomToken(id);

    //console.log("Custom token generated");
    final_response.token = custom_token;
    return custom_token;
  } catch (error) {
    // //console.log(error);
    return JSON.stringify({ statusCode: 400, error: error });
  }

  //TODO: Step 3 grab refresh token and stuff
};

const fitbitRevokeAccess = async (access_token, refresh_token) => {
  try {
    let res = await axios({
      method: "POST",
      url: "https://api.fitbit.com/oauth2/revoke",
      headers: {
        Authorization: `Basic ${process.env.FITBIT_BASIC}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      params: {
        token: access_token,
      },
    });

    //console.log(res);
  } catch (error) {}
};

const fitbitRefreshAccessToken = async (refresh_token) => {
  try {
    //console.log("Trying to refresh access token...", refresh_token);

    let response = await axios({
      method: "POST",
      url: "https://api.fitbit.com/oauth2/token",
      params: {
        grant_type: "refresh_token",
        refresh_token: refresh_token,
      },
      headers: {
        Authorization: `Basic ${process.env.FITBIT_BASIC}`,
      },
    });
    //console.log(response["data"]);
    //store new refresh token in database, because they can only be used once
    //console.log("adding new refresh token to the DB");
    await db
      .collection("users")
      .doc(response["data"]["user_id"])
      .set(
        {
          fitbit: { refresh_token: response["data"]["refresh_token"] },
        },
        { merge: true }
      );
    return response["data"];
  } catch (error) {
    //console.log(error["response"]);
    return error;
  }
};

const fitbitGetMap = async (access_token, user_id) => {
  try {
    //console.log("getting map....");
    let today = new Date();
    let tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    let activity_list = await axios({
      method: "GET",
      url: `https://api.fitbit.com/1/user/${user_id}/activities/list.json`,
      headers: { Authorization: `Bearer ${access_token}` },
      params: {
        "user-id": "-",
        beforeDate: tomorrow.toISOString().split("T")[0],
        sort: "desc",
        limit: data_limit,
        offset: 1,
      },
    }).catch((err) => {
      //console.log(`Error grabbing activity list${err}`);
    });
    //we've nabbed list of activities, now grab the tcx link
    //for activities where no GPS is recorded (Auto detected walks etc) we can't use them
    //so find the most recent activity that we can use
    //in future allow user to see a list of last 10 activities??????
    ////console.log("got activity list ", activity_list["data"]);
    //console.log(activity_list);
    let parsed = await getParsedMap(activity_list, access_token);
    // //console.log(parsed);
    return parsed;
    // let parsed = parseString(map["data"], (err, result) => {
    //   if (result) return result;
    //   if (err) {
    //     //console.log(`Error parsing map, ${err}`);
    //     return err;
    //   }
    // });
    // return parsed;
  } catch (error) {
    return error;
  }
};

const getParsedMap = async (activity_list, access_token) => {
  let t;
  let map;
  let parser;
  //using https://www.npmjs.com/package/tcx-js
  //to parse tcx file
  //now have array of trackpoints containing location, heartrate, speed, etc one per second... :D
  //NOTE: I had to modify the source code of the module to accept string input of tcx instead of just files.

  for (let i = 0; i < data_limit; i++) {
    //console.log("Loop: " + i);
    //console.log(access_token);
    if (activity_list["data"]["activities"][i]["source"]) {
      // //console.log(activity_list["data"]["activities"][i]);
      t = activity_list["data"]["activities"][i]["tcxLink"];
      //console.log(t);
      if (t != undefined) {
        //get the map and try to parse it
        map = await axios({
          method: "GET",
          url: t,
          headers: { Authorization: `Bearer ${access_token}` },
        }).catch((err) => {
          //console.log(`Error finding tcx for given activity ${err}`);
        });
        //console.log("got map");
        //console.log("parsing");
        if (map["data"]) {
          //console.log("hello there");
        }
        try {
          parser = new tcx.Parser(map["data"]);
          // //console.log(parser.activity);
          if (parser.activity.sport == "Running") {
            //console.log(map["data"]);
            //console.log("breaking arent i to bne fair");
            break; //we have found the most recent map
          } else {
            throw Error;
          }
        } catch (error) {
          //console.log(error.message);
          t = "";
          parser = "";
          ////console.log(error);
          //console.log("nope broseph brones");
        }
      } //sometimes, the activity can have a tcx link that returns undefined i.e. if the user accidentally records a run for a second or two.. happened to me whilst testing
    }
  }

  if (t == undefined || t == "" || parser == "") {
    //no activity in last 5 has a map
    //console.log("no activity has a map");
    return -1;
  }
  return parser.activity;
};

module.exports = {
  fitbitGetAccessToken,
  fitbitGetMap,
  fitbitRefreshAccessToken,
  fitbitRevokeAccess,
};
