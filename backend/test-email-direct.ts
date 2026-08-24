import { config } from './src/config';
import nodemailer from 'nodemailer';

async function testEmail() {
  console.log('User:', config.gmail.user);
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.gmail.user,
      pass: config.gmail.appPassword,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: `"Ticket Booking" <${config.gmail.user}>`,
      to: config.gmail.user, // Send to self
      subject: 'Test Email from Ticket Booking',
      text: 'This is a test email to verify Nodemailer configuration.',
    });
    console.log('Email sent successfully:', info.messageId);
    console.log('Accepted:', info.accepted);
    console.log('Rejected:', info.rejected);
    console.log('Response:', info.response);
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}

testEmail();
