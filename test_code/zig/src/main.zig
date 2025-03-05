const std = @import("std");

pub fn main() !void {
    std.debug.print("All your {s} are belong to us.\n", .{"codebase"});

    const stdout_file = std.io.getStdOut().writer();
    var bw = std.io.bufferedWriter(stdout_file);
    const stdout = bw.writer();

    try stdout.print("Run `zig build test` to run the tests.\n", .{});

    try hello(stdout.any(), "my number is {}");

    try bw.flush();
}

fn hello(writer: std.io.AnyWriter, comptime str: []const u8) !void {
    const number = getNumber();

    try writer.print(str, .{number});
}

fn getNumber() i32 {
    return 1337;
}
