const { db, admin } = require("./firebase.js");

require("dotenv").config();

//BEFORE DEPLOYING: UNCOMMENT THIS!
// let redirect_uri =
//   "https://europe-west2-musicmakesyourunfaster.cloudfunctions.net/app/api/spotify/user-auth";

// let redirect_uri =
//   "http://localhost:5000/musicmakesyourunfaster/europe-west2/app/api/spotify/user-auth";
// let redirect_uri = "https://musicmakesyourunfaster.firebaseapp.com/fitbit";
// let redirect_uri = "http://localhost:3000/continue-setup";
console.log(process.env.FUNCTIONS_EMULATOR);

//change uri based on environment
let redirect_uri = process.env.FUNCTIONS_EMULATOR
  ? "http://localhost:3000/continue-setup"
  : "https://musicmakesyourunfaster.firebaseapp.com/continue-setup";
let SpotifyWebApi = require("spotify-web-api-node");

let spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: redirect_uri,
});

const spotifyGetAccessToken = async (token, userId) => {
  try {
    let data = await spotifyApi.authorizationCodeGrant(token);
    console.log(`The token expires in ${data.body.expires_in}`);
    console.log(`The token is ${data.body.access_token}`);
    console.log(`The refresh token is ${data.body.refresh_token}`);
    console.log(`adding to database user ${userId}..."`);
    await db
      .collection("users")
      .doc(userId)
      .set(
        {
          spotify: {
            refresh_token: data.body.refresh_token,
          },
        },
        { merge: true }
      );
    console.log("added!");
    return { status: 200, message: "success!" };
  } catch (error) {
    console.log(error);
    return error.body;
  }
};

const spotifyRefreshAccessToken = async (refreshToken) => {
  console.log("Attempting to refresh access token", refreshToken);
  let spotifyApi = new SpotifyWebApi({
    refreshToken: refreshToken,
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: redirect_uri,
  });
  try {
    let res = await spotifyApi.refreshAccessToken();
    console.log(res.body);
    return res.body;
  } catch (error) {
    console.log(error.body);
    return error.body;
  }
};

const spotifyGetRecentTracks = async (accessToken) => {
  //get last 50 played tracks
  let spotifyApi = new SpotifyWebApi({
    accessToken: accessToken,
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: redirect_uri,
  });
  let data = await spotifyApi.getMyRecentlyPlayedTracks({
    limit: 50,
  });

  // Output items
  console.log("Your 50 most recently played tracks are:");
  let songs = [];
  //create an array of song objects, extracting only useful data for each
  data.body.items.forEach((item) =>
    songs.push({
      name: item.track.name,
      artists: item.track.artists,
      href: item.track.href,
      id: item.track.id,
      played_at: item.played_at.split(".")[0],
      duration: item.track.duration_ms,
      rough_started_at:
        new Date(item.played_at).getTime() - item.track.duration_ms,
      cover_art: item.track.album.images[0],
      uri: item.track.uri,
    })
  );

  let query = [];
  songs.forEach((song) => query.push(song.id));
  let audioFeatures = await spotifyApi.getAudioFeaturesForTracks(query);

  //merge the audio features into each song object
  songs = songs.map((song) => {
    let id = audioFeatures.body.audio_features.filter((s) => s.id == song.id);
    return { ...song, audio_features: id };
  });
  console.log(songs[0]);
  return { tracks: [...songs], access_token: spotifyApi.getAccessToken() };

  // songs.map((song)=>{
  //   return {...song,audio_features:}
  // })
  // getSongInfo(songs[0]["id"]);
};

//returns WAYYYYY TO MUCH DATA, A BIT OVER COMPLEX FOR WHAT WE NEED
//   spotifyApi.getAudioAnalysisForTrack(song_id).then(
//     (data) => {
//       console.log(data.body);
//     },
//     (err) => {
//       console.log(err);
//     }
//   );
//Spotify don't provide individual song genres :()
//key = 0,1...10,11 integers map to pitches using standard Pitch Class notation . E.g. 0 = C, 1 = C♯/D♭, 2 = D, and so on.
//mode = 0,1. 0 is minor, 1 is major :)
//valence = 0.0 to 1.0, high valence = more positive, lower is more negtive (depressed, sad, angry)
//time signature is integer, how many beats in bar. i.e. time_signature:4 = 4/4???
//tempo = integer bpm
//would be interesting to get list of time signatures that match common running rhythms and see if they help
//also faster tempos = faster run speeds????????????????
//speechniess (less important maybe, )
/*
  speechiness detects the presence of spoken words in a track. The more exclusively speech-like the recording (e.g. talk show, audio book, poetry), 
  the closer to 1.0 the attribute value. Values above 0.66 describe tracks that are probably made entirely of spoken words. Values between 0.33 and 0.66 
  describe tracks that may contain both music and speech, either in sections or layered, including such cases as rap music. Values below 0.33 most likely 
  represent music and other non-speech-like tracks.
  */
//loudness is decibels
//liveness detects presence of audience in song bigger values is more likely it was live
//danceability -> bigger = more danceable could be interesting to see if this has any effects
//accousticness -> bigger = more likely to be acoustic, would possibly think less acoustic means better perfoemance?
//energy -> 0 to 1 -> measure of intensity and activity

module.exports = {
  spotifyGetAccessToken,
  spotifyGetRecentTracks,
  spotifyRefreshAccessToken,
};
