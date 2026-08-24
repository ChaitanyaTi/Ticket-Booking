const nodemailer = require('nodemailer');

async function testEmail() {
  console.log('Sending test email...');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'clickitttttt@gmail.com',
      pass: 'ntjk fydy yzti mwcy',
    },
  });

  try {
    const info = await transporter.sendMail({
      from: '"Ticket Booking" <clickitttttt@gmail.com>',
      to: 'chaitanyatiwari23@gmail.com',
      subject: 'Test Email from Nodemailer',
      text: 'This is a test to verify Gmail SMTP configuration.',
      html: '<p>This is a test to verify Gmail SMTP configuration.</p>',
    });
    console.log('Success! Email sent.');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

testEmail();
