import { admin, db } from "../config/firebase.js";

export const googleLogin = async (req, res) => {

  try {

    const { token } = req.body;

    const decodedToken = await admin.auth().verifyIdToken(token);

    const uid = decodedToken.uid;
    const email = decodedToken.email;
    const name = decodedToken.name;

    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {

      await userRef.set({
        name,
        email,
        createdAt: new Date()
      });

    }

    res.json({
      message: "Login Success",
      uid
    });

  } catch (error) {

    res.status(401).json({
      error: "Invalid Token"
    });

  }

};