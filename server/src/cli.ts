import {startServer} from './index';
const instance=startServer(Number(process.env.PORT||8787),process.env.HOST||'127.0.0.1');
instance.server.on('listening',()=>console.log(`RemoteB2B signaling: ${JSON.stringify(instance.server.address())}`));
instance.server.on('error',error=>{console.error(error.message);process.exitCode=1;});
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>void instance.close());
