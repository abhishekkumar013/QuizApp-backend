import admin from "firebase-admin"

export const sendNotification = async (fcmToken: string, title: string, body: string) => {
    try {
      await admin.messaging().send({
        token: fcmToken,
        notification: { title, body },
      });
    } catch (error) {
      console.error("Error sending FCM:", error);
    }
  };