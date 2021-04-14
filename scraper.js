const puppeteer = require("puppeteer");
const { db } = require("./firebase.js");
require("dotenv").config();

// const C = require("./constants");
C = {
  username: process.env.FITBIT_TEST_USERNAME,
  password: process.env.FITBIT_TEST_PASSWORD,
};

console.log(C);
const USERNAME_SELECTOR = "form#loginForm";
const PASSWORD_SELECTOR = "input#password";

async function startBrowser() {
  const browser = await puppeteer.launch({
    // headless: false,
    waitUntil: "domcontentloaded",
  });
  const page = await browser.newPage();
  return { browser, page };
}

async function closeBrowser(browser) {
  return browser.close();
}

async function createNewUserAndLogin(url, browser, page) {
  page.setViewport({ width: 1366, height: 768 });
  await page.goto(url);
  await new Promise((r) => setTimeout(r, 4000));
  for (let i = 0; i < 5; i++) {
    console.log("tabbingt");
    await page.keyboard.press("Tab", {
      delay: 100,
    });
  }
  await page.keyboard.type(process.env.FITBIT_TEST_USERNAME);
  await page.keyboard.press("Tab", {
    delay: 100,
  });
  await page.keyboard.type(process.env.FITBIT_TEST_PASSWORD);
  await page.keyboard.type(String.fromCharCode(13));
  await page.waitForNavigation();
  await new Promise((r) => setTimeout(r, 8000));
  await page.goto(
    "https://accounts.spotify.com/authorize?client_id=07333755bcb145f691d3bcb5477b47e4&response_type=code&redirect_uri=https://musicmakesyourunfaster.firebaseapp.com/continue-setup&scope=streaming%20user-read-private%20user-read-email%20user-read-playback-state%20user-modify-playback-state%20user-read-recently-played"
  );
  await new Promise((r) => setTimeout(r, 2500));
  await page.keyboard.type(process.env.SPOTIFY_TEST_USERNAME);
  await page.keyboard.press("Tab", {
    delay: 100,
  });
  await page.keyboard.type(process.env.SPOTIFY_TEST_PASSWORD);
  await page.keyboard.type(String.fromCharCode(13));
  await new Promise((r) => setTimeout(r, 10000));
  await closeBrowser(browser);
}
const main = async () => {
  const { browser, page } = await startBrowser();
  await createNewUserAndLogin(
    "https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=22C8M7&redirect_uri=https://musicmakesyourunfaster.firebaseapp.com/fitbit&scope=activity%20heartrate%20location%20profile",
    browser,
    page
  );
  let d = await db.collection("users").doc("9BSVPX").get();
  return d.data();
};

module.exports = { main };
