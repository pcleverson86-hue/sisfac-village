function NeedToShowBalloon(elem){
	if(!elem)return false;
	if(!elem.tagName||elem.tagName.toLowerCase()!="input")return false;
	if(!elem.type||elem.type.toLowerCase()!='password')return false;
	var inputs=document.getElementsByTagName('input');
	var p=-1,pp=-1,f=false;
	function p_near(i,j){
		function r(x){return Math.round(x);}
		function bnd(e){return e.getBoundingClientRect();}
		function hid(p){if (p&&(((p.right-p.left)==0)||((p.top-p.bottom)==0)))return true;return false;}
		function abs(a){return Math.abs(a);}
		var r1=bnd(inputs[i]);
		var r2=bnd(inputs[j]);
		if (hid(r1))return false;
		if (hid(r2))return false;
		var dx=abs(r(r2.left-r1.left));
		var dy=abs(r(r2.top-r1.top));
		var dxw=abs(r(r2.left-r1.right));
		var dyh=abs(r(r2.top-r1.bottom));
		var n=10,m=130;
		if(dy<=n&&dxw<=m)return true;
		if(dy<=m&&dxw<=n)return true;
		if(dx<=n&&dyh<=m)return true;
		if(dx<=m&&dyh<=n)return true;
		return false;
	};
	function in_double_set(i,j)
	{
		if(elem==inputs[i]||elem==inputs[j])return true;
		return false;
	}
	function check_double()
	{
		if(f)
		{
			if(p>=0&&pp>=0&&in_double_set(p,pp))return true;
			f=false;
		}
		p=-1;pp=-1;
		return false;
	}
	for(var i=0;i<inputs.length;++i){
		if(inputs[i].type.toLowerCase()=="password"){
			if (p>=0){
				if(p_near(p,i)){
					if(pp>=0){
						if(in_double_set(i,p))return true;
						p=-1;pp=-1;
					}else{
						if((i==inputs.length-1)&&(in_double_set(i,p)))return true;
						f=true;
					}
				}else{
					if(check_double())return true;
				}
				pp=p;
			}
			p=i;
		}else{
			if(check_double())return true;
		}
	}
	return false;
}
