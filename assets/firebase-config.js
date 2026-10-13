/* Google sign-in and cloud sync are switched on by filling in these values.
   They come from the Firebase console: Project settings -> General -> Your apps -> Web app -> SDK setup and configuration.
   These values identify your project; they are not secrets. Access is limited by firestore.rules, not by hiding them.
   Leave the values empty and the site works exactly as before, with progress kept in the browser only. */
window.CTT_FIREBASE = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  appId: ""
};
