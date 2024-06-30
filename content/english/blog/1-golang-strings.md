---
title: "Strings in Golang"
meta_title: "Strings in Golang"
description: "Strings in Golang"
date: 2024-30-06T05:00:00Z
image: "/images/go-blue.png"
categories: ["Golang"]
author: "Hamza Masood"
tags: ["Golang"]
draft: false
---

Strings in golang are represented as unicode
Unicode represents numbers that are bigger than what fit into a byte. On the other hand, a Rune is the go equivalent of what you think of a character. A rune in golang, can also be known as a wide character in other languages. A rune can fit any logical printable character, even chinese characters!

In order to make programs more efficient we don't want to refer to every character all the time with more bytes (unicode), since a lot of the programs are just going to have english characters (ascii characters). There is an efficient way of encoding unicode called UTF8. Which is a short way of representing unicode in bytes.

{{< notice "note" >}}
Strings are physically, the UTF8 encoding of unicode, also known as a byte in golang.
{{< /notice >}}

A rune is a synonym for  int32 (32 bit integer) aka unicode.</br>
A byte is a synonym for uint8 (8 bit integer)

A string is physically a sequence of bytes and logiaclly a sequence of unicode (also known as runes). They are the UTF8 encoding of unicode characters. Also, ASCII characters fit into the range 0-127. So if you see numbers outside of this range then you know it's not ASCII.

```golang
package main  
  
import "fmt"  
  
func main() {  
    s := "èlite"  
    b := []byte(s)  
    fmt.Printf(" %d", len(b))  
}
```

The output is `6`</br>
Why?: The length of the string in a program is the length of the byte string that is necessary to encode in UTF8. Visually it is 5 characters, but the length is 6. If you want the length of the string, you have to ask yourself, how many bytes does the string represent?

6 represents the length of the byte string that is necessary to encode the string to UTF8. This string is still 6 bytes in UTF8 encoding. The length of the string does not represent the number of unicode characters.

To solidify this concept here are 2 slices being taken from a string:

```golang
s := "hello, world"
hello := s[:5]
world := s[7:]
```
Here is the graphical view of the above code:

{{< image src="images/strings.png" caption="" alt="alter-text" height="" width="" position="center" command="fill" option="q100" class="img-fluid" title="image title"  webp="false" >}}

s is a string descriptor. A descriptor is not a pointer, a descriptor describes something and has a pointer within it. The descriptor also includes the length of the string. Also to note, the end of the string does not have a nul byte like other programming languages.</br>
The main takeaway here is that `s`, `hello`, and `world` are all substrings and are reusing the same immutable memory.

for example, if you define `t:=s` then this means `t` has the same length, and is pointing to the same bytes or area in memory but it is a different descriptor because it is named `t` and not `s`
