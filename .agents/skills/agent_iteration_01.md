## Iteration 01 (Frontend Setup + UI Kit)
Goal: Setup Frontend with shadcn/ui and implement basic pages for authentication (signin, signup) and landing page.

- Ui will always be designed with responsiveness to support all kind of devices.

# Overview of this application
- Building a web application that turns a job description into a personalised interview preparation kit.
- The user pastes in the job description, gives you the company's website address, and tells you how many days they have before the interview. From there the application does the research itself: it crawls the company site to find what they do and how they hire, looks for public discussion of that company's interview process, and combines all of it with the job description to generate a structured kit - a company brief, a breakdown of the role, a bank of likely questions, flashcards, and a day-by-day study schedule. The user can then reshape any part of it, and practise against it inside the app.

# Overall overview
Building an application where a user can:
• Register and log in, and see only their own kits
• Create a kit by pasting in a job description and the company website address
• Prepare for more than one role at once by uploading a file of description-and-company pairs
• Say how many days they have before the interview
• Watch the kit being generated, with visible progress and clear failure states
• Read a company brief, a role breakdown, a categorised question bank, flashcards and a study
schedule
• Edit, reorder, add and delete anything in the kit
• Regenerate one section without losing edits made elsewhere
• Practise against the flashcards and track what they have covered


## Iteration 01 only setups the auth functionality, and signup, signin pages with working logic + jwt + jwt persistence in local storage + protected not for the whole page but for the functions users are accessing, like only signed in user should be able to call the apis but the frontend should guide user interactively about they need to signup/signin to access the features, and then when user signup/signin then come back to that specific page where user left using something like query parameters in the url about where to redirect after successful signup/signin or default is going to be the dashboard. And signup/signin should also be available explicitly as well.

- Everywhere use shadcn ui for the stylings and making the common ui components throughtout the structuring of layout for better results. Style them, make it look professional and clean

You have to design the mesmorizing landing page with some button in center which takes user to the dashboard.

The dashboard is treated the main page after the landing page as it's where user spends most of the time, so it should be interactive, look professional and clean, and should be easy to navigate.

The dashboard page should have the Left Sidebar, Top header bar, Main Content Area.
The left sidebard's bottom has the signup/signin functionality, and the left side bar will contain the navigation links to the different pages of the application. All pages will have this leftside bar, but the signup/signin links should only be visible when the user is not logged in, so instead of showing the content of page like kits, show them not to auth, and they should see the prep for interview create buttons but should say login to create kit or signup to create kit, as there will be two buttons to signup and signin as well, so if the user is not logged in then when he clicks on signup or signin, it should take him to the signup or signin page respectively, and when the user is logged in then he should not see the signup or signin links, but the kits navigation links and other navigation links related to the logged in user, and 

The top header bar should contain the application name and some other utility links, and info about the current page user is at on.

The Leftside bar is expandable and collapsable, and on small devices it should be hidden by default and should be revealed on click on the hamburger menu in the top header bar.
The leftside bar will contain the page like kits, interview prep, etc , on click on them the url can also change but sidebar remains same and the main screen content should change.

On Preparing for Interview the main screen should now show a input form from user which will appear only when the user clicks on the create button, and please design the ui around every of these pages.

On click on the create button in interview prep, the form will appear for signed users, and the form will contains fields for "JD", "company_url", "days" .
and after clicking on the create button, i'll design the rest part.

The signup will give have form for name, email, password. The signup can get these response so handle them => json({ success: false, msg: "Email, password and name are required" }); or json({ success: true, msg: "User created successfully", token }); or json({ success: false, msg: error.message || "Failed to signup" });
on successfull, please also use zustand store with persistent storage to store the user name and email okay , the token will have the user's info, jwt token is when decoded is a object with fields userId, email, and name, you should decode that info and store it in the zustand store as user name, user email, user id, and jwt token in persistence storage. the frontend will also need a way to check if the user is logged in or not, and if the user is logged in then he should not see the signup or signin links, but the kits navigation links and other navigation links related to the logged in user, this is what i want for the auth system. and signin should work the same way, but instead of creating a new user, it should log in the existing user and return the token. the sign in input is email and password for the form, and in return the json({ success: false, msg: "Email and password are required" }); or json({ success: true, msg: "Login successful", token }); or json({ success: false, msg: error.message || "Invalid credentials" }); handle them gracefully as well.

So please complete this flow.
Good luck