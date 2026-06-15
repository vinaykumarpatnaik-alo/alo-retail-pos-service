import jwt from "jsonwebtoken";

export default function encodeAuthToken() {
  const currentTime = new Date();

  const SIGNUP_API_KEY = process.env.SIGNUP_API_KEY;
  const SIGNUP_API_SECRET_KEY = process.env.SIGNUP_API_SECRET_KEY;

  console.log("Loading the signup apps credentials.....");
  return jwt.sign(
    {
      aud: SIGNUP_API_KEY,
      //   sub: "1",
      //   exp: Math.floor(currentTime.getTime() / 1000 + 300),
    },
    SIGNUP_API_SECRET_KEY,
    { algorithm: "HS256" }
  );
}
