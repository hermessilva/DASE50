const { spawn } = require("child_process");
const binary = "C:\\Program Files\\nodejs\\claude.cmd";
const args = ["--version"];

const inner = '"' + binary + '" ' + args.join(" ");
const cmdLine = '"' + inner + '"';
console.log("CmdLine:", JSON.stringify(cmdLine));

const c = spawn("cmd.exe", ["/d", "/s", "/c", cmdLine], {
    windowsHide: true,
    windowsVerbatimArguments: true
});

let so = "";
let se = "";
c.stdout.on("data", d => so += d);
c.stderr.on("data", d => se += d);
c.on("close", code => console.log("EXIT=" + code + " STDOUT=" + JSON.stringify(so) + " STDERR=" + JSON.stringify(se)));
c.on("error", e => console.log("ERROR=" + e.message));
