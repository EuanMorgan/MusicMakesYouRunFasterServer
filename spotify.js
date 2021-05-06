const { db } = require("./firebase.js");
const moment = require("moment-timezone");

require("dotenv").config();

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
    ////console.log(`The token expires in ${data.body.expires_in}`);
    ////console.log(`The token is ${data.body.access_token}`);
    ////console.log(`The refresh token is ${data.body.refresh_token}`);
    ////console.log(`adding to database user ${userId}..."`);
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
    ////console.log("added!");
    return { status: 200, message: "success!" };
  } catch (error) {
    ////console.log(error);
    return error.body;
  }
};

const spotifyRefreshAccessToken = async (refreshToken) => {
  ////console.log("Attempting to refresh access token", refreshToken);
  let spotifyApi = new SpotifyWebApi({
    refreshToken: refreshToken,
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: redirect_uri,
  });
  try {
    let res = await spotifyApi.refreshAccessToken();
    ////console.log(res.body);
    return res.body;
  } catch (error) {
    ////console.log(error.body);
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
  ////console.log("Your 50 most recently played tracks are:");
  let songs = [];
  //create an array of song objects, extracting only useful data for each
  data.body.items.forEach((item) =>
    songs.push({
      name: item.track.name,
      artists: item.track.artists,
      href: item.track.href,
      id: item.track.id,
      played_at: moment(item.played_at)
        .utcOffset("+01:00")
        .format()
        .slice(0, 19), //DEFAULT IS UTC, NEED TO CONVERT TO BST, ALSO IF SUPPORTING OTHER TIMEZONES IN FUTURE
      duration: item.track.duration_ms,
      rough_started_at:
        new Date(item.played_at).getTime() - item.track.duration_ms,
      cover_art: item.track.album.images[0],
      uri: item.track.uri,
    })
  );
  ////console.log(songs[0]);
  let query = [];
  let artists_query = [];
  //let song_lookup = [];

  songs.forEach((song) => {
    query.push(song.id);
    // song_lookup.push({
    //   id: song.id,
    //   artist: song.artists[0].name,
    //   name: song.name,
    // });
    artists_query.push(song.artists[0].id);
  });

  let artists = await spotifyApi.getArtists(artists_query);
  ////console.log(artists.body.artists);
  let audioFeatures = await spotifyApi.getAudioFeaturesForTracks(query);
  // let genres = await getGenres(song_lookup);
  //merge the audio features into each song object
  songs = songs.map((song) => {
    let id = audioFeatures.body.audio_features.filter((s) => s.id === song.id);
    let artist_id_match = artists.body.artists.filter(
      (a) => a.id === song.artists[0].id
    );
    return {
      ...song,
      audio_features: [id[0]],
      artist_data: {
        id: artist_id_match[0].id,
        name: artist_id_match[0].name,
        genres: artist_id_match[0].genres,
        image: artist_id_match[0].images[0],
      },
    };
  });
  ////console.log(songs[10]);
  return { tracks: [...songs], access_token: spotifyApi.getAccessToken() };

  // songs.map((song)=>{
  //   return {...song,audio_features:}
  // })
  // getSongInfo(songs[0]["id"]);
};

const similarSongs = async (token, data) => {
  // //console.log(token);
  //console.log([...data.seed_songs]);
  let spotifyApi = new SpotifyWebApi({
    accessToken: token,
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: redirect_uri,
  });

  let random = data.seed_songs.sort(() => 0.5 - Math.random()).slice(0, 5);
  let range = 0.4;
  let options = {
    max_acousticness: data.data[0] + range,
    max_danceability: data.data[1] + range,
    max_energy: data.data[2] + range,
    max_valence: data.data[3] + range,
    max_speechiness: data.data[4] + range,

    min_acousticness: data.data[0] - range,
    min_danceability: data.data[1] - range,
    min_energy: data.data[2] - range,
    min_valence: data.data[3] - range,
    min_speechiness: data.data[4] - range,

    seed_tracks: random,
  };

  let options2 = {
    min_energy: 0.4,
    seed_artists: ["6mfK6Q2tzLMEchAr0e9Uzu", "4DYFVNKZ1uixa6SQTvzQwJ"],
    min_popularity: 50,
  };

  // //console.log(options, options2);

  let songs = await spotifyApi.getRecommendations(options);
  // //console.log(songs.body);

  //console.log("creating");
  let date = new Date().toISOString().split("T")[0];

  let x = await db.collection("users").doc(data.id).get();
  let last = x.data().spotify;
  if (last.last_created_playlist === date) {
    return last.last_playlist_id;
  }

  let playlist = await spotifyApi
    .createPlaylist(`Recommended Running Songs ${date}`, {
      description:
        "Auto-created by Music Makes You Run Faster... Sorry if this is annoying 😂",
      public: false,
    })
    .catch((err) => console.log(err));

  await db
    .collection("users")
    .doc(data.id)
    .set(
      {
        spotify: {
          last_created_playlist: date,
          last_playlist_id: playlist.body.uri,
        },
      },
      { merge: true }
    );

  //console.log("adding");

  // //console.log(playlist.body.id, songs.body.tracks);

  await spotifyApi
    .addTracksToPlaylist(
      playlist.body.id,
      songs.body.tracks.map((song) => song.uri)
    )
    .catch((err) => console.log(err));

  return playlist.body.uri;
};

//was going to use last FM to lookup song genres via tags... however this returns blank for most songs

// const getGenres = async (songdata) => {
//   let song_genre_lookup = {};
//   song_genre_lookup = await Promise.all(
//     await songdata.map(async (song) => {
//       try {
//         let url = `https://ws.audioscrobbler.com/2.0/?method=track.getTags&api_key=0668944de0e5eb9adadd817bddb5705e&artist=${song.artist
//           .split(" ")
//           .join("+")}&track=${song.name
//           .split(" ")
//           .join("+")}&user=RJ&format=json`;
//         ////console.log(url);
//         const res = await axios({
//           url: url,
//           method: "GET",
//         });
//         return res.data;
//       } catch (err) {
//         return null;
//       }
//     })
//   );
//   ////console.log(song_genre_lookup);
// };

//returns WAYYYYY TO MUCH DATA, A BIT OVER COMPLEX FOR WHAT WE NEED
//   spotifyApi.getAudioAnalysisForTrack(song_id).then(
//     (data) => {
//       ////console.log(data.body);
//     },
//     (err) => {
//       ////console.log(err);
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
  similarSongs,
};
