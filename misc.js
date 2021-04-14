const { db } = require("./firebase.js");
const deleteAccount = async () => {
  let ref = db.collection("users").doc("99GN7F");
  //   deleteCollection(uid);

  if ((await ref.get()).exists) {
    await ref.delete();
  }

  return "done";
};

module.exports = { deleteAccount };
