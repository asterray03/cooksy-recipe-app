import { admin, db } from "../config/firebase.js";

/*
USER SIGNUP
*/
export const signupUser = async (req, res) => {
  try {

    const { name, email, password } = req.body;

    // Create user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name
    });

    // Save user in Firestore
    await db.collection("users").doc(userRecord.uid).set({
      name,
      email,
      createdAt: new Date()
    });

    res.status(201).json({
      message: "User Created",
      uid: userRecord.uid
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};


/*
USER LOGIN
*/
export const loginUser = async (req, res) => {
  try {

    const { email } = req.body;

    const user = await admin.auth().getUserByEmail(email);

    res.json({
      message: "Login Success",
      uid: user.uid
    });

  } catch (error) {
    res.status(400).json({
      error: "User not found"
    });
  }
};