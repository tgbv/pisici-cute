// import
const Http = require('http')
const SocketIo = require('socket.io')
const Express = require('express')
const Dotenv = require('dotenv')
const Compression = require('compression')
const FileType = require('file-type')
const Md5 = require('md5')
const Fs = require('fs')

// setup
Dotenv.config()
const Server = Express()
const Binder = Http.createServer(Server)
const IO = SocketIo( Binder, {
	maxHttpBufferSize: 5e9
} )

// routes;
Server.get(/^.*$/, (req, res, next)=>{
		if(req.originalUrl !== '/')
			res.sendFile(__dirname+'/public/'+req.originalUrl, error=>{
				res.end()
			})
		else
			res.sendFile(__dirname+'/public/index.htm')
		

})

// use it here because the way socketio requires binding
Server.use(Compression)

// utils
const readDb = function(){
	return JSON.parse(Fs.readFileSync('./database.txt', { encoding: 'utf8' }))
}
const writeDb = function(data) {
	return Fs.writeFileSync('./database.txt', JSON.stringify(data), { encoding: 'utf8' })
}

// ws server setup
IO.on('connection', async Socket=>{

	Socket.emit('all_kittens', readDb())

	// on posted kitten
	Socket.on('post_kitten_send', async data=>{
		try {
			// check text
			if(
				!data.kitten_name || 
				data.kitten_name.length < 1 ||
				data.kitten_name.length > 255
			)
				return Socket.emit('post_kitten_reply', {
					success: false,
					message: 'Numele pisicuței este invalid :(',
				})

			// check file type
			if( data.kitten_data)
			{
				let fileTypes = ['video/mp4', 'image/png', 'image/jpeg', 'image/jpg']
				let fileType = await FileType.fromBuffer(data.kitten_data)

				if(fileTypes.includes( fileType.mime ))
				{
					// make filename
					let fname = Md5(+ new Date) +'.'+ fileType.ext

					// make record
					let record = {
						likes: 0,
						fname: fname,
						name: data.kitten_name,
					}

					// push data to db
					let db = readDb()
					db.push(record)
					writeDb(db)

					// move file to storage
					Fs.writeFileSync(`public/uploads/${fname}`, data.kitten_data)

					// broadcast to everyone
					IO.emit('new_kitten', record)

					// ok
					Socket.emit('post_kitten_reply', {
						success: true,
					})
				}
				else
					return Socket.emit('post_kitten_reply', {
						success: false,
						message: 'Formatul fișierului încărcat nu este suportat.',
					})
			}
			else
				return Socket.emit('post_kitten_reply', {
					success: false,
					message: 'Formatul fișierului încărcat nu este suportat.',
				})
		}

		// should not be reached
		catch(e) {
			console.log(e)
			Socket.emit('post_kitten_reply', {
				success: false,
				message: 'Eroare pe server. Te rog reîncearcă.',
			})
		}

	})

	// on liked kitty
	Socket.on('liked_kitty', async fname=>{

		// update db
		let db = readDb()
		db.find(item=>item.fname === fname).likes++ 
		writeDb(db)

		// broadcast like
		IO.emit('kitten_liked', fname )
	})
})


// start binder server
Binder.listen(
	process.env.PORT,
	process.env.HOST,
	()=>{
		console.log('server started')
	}
)